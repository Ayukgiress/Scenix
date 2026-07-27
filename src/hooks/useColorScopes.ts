import { useEffect, useRef, useState, useCallback } from "react"
import type { RefObject } from "react"

// ─── worker source (inlined as a blob so no bundler config needed) ────────────
//
// The worker receives { pixels: Uint8ClampedArray, width, height } and replies
// with { waveform, vectorscope, histogram } as transferable buffers.
//
// Waveform  – 256 columns × 256 rows luma accumulator (Float32, normalised 0-1)
// Vectorscope – 256×256 Cb/Cr accumulator (Float32, normalised 0-1)
// Histogram – 256 bins × 4 channels [R,G,B,Luma] (Float32, normalised 0-1)

const WORKER_SRC = /* js */ `
self.onmessage = function(e) {
  const { pixels, width, height } = e.data;
  const total = width * height;

  // Waveform: 256 columns, each column accumulates luma values 0-255
  const WW = 256, WH = 256;
  const waveform = new Float32Array(WW * WH);

  // Vectorscope: 256×256 Cb/Cr plane
  const VS = 256;
  const vectorscope = new Float32Array(VS * VS);

  // Histogram: 256 bins × 4 channels (R,G,B,Luma)
  const histR = new Float32Array(256);
  const histG = new Float32Array(256);
  const histB = new Float32Array(256);
  const histL = new Float32Array(256);

  const colStep = width / WW;

  for (let i = 0; i < total; i++) {
    const base = i * 4;
    const r = pixels[base];
    const g = pixels[base + 1];
    const b = pixels[base + 2];

    // Rec.709 luma
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Waveform column = pixel x mapped to 0-255
    const px = i % width;
    const col = Math.min(WW - 1, Math.floor(px / colStep));
    const row = Math.min(WH - 1, Math.floor(luma / 256 * WH));
    waveform[row * WW + col] += 1;

    // Vectorscope: Cb/Cr from YCbCr
    const cb = Math.round(128 - 0.16874 * r - 0.33126 * g + 0.5 * b);
    const cr = Math.round(128 + 0.5 * r - 0.41869 * g - 0.08131 * b);
    const vx = Math.min(VS - 1, Math.max(0, cb));
    const vy = Math.min(VS - 1, Math.max(0, 255 - cr));
    vectorscope[vy * VS + vx] += 1;

    // Histogram
    histR[r] += 1;
    histG[g] += 1;
    histB[b] += 1;
    histL[Math.min(255, Math.round(luma))] += 1;
  }

  // Normalise waveform
  let wMax = 0;
  for (let i = 0; i < waveform.length; i++) if (waveform[i] > wMax) wMax = waveform[i];
  if (wMax > 0) for (let i = 0; i < waveform.length; i++) waveform[i] /= wMax;

  // Normalise vectorscope
  let vMax = 0;
  for (let i = 0; i < vectorscope.length; i++) if (vectorscope[i] > vMax) vMax = vectorscope[i];
  if (vMax > 0) for (let i = 0; i < vectorscope.length; i++) vectorscope[i] /= vMax;

  // Normalise histogram (per-channel)
  let rMax = 0, gMax = 0, bMax = 0, lMax = 0;
  for (let i = 0; i < 256; i++) {
    if (histR[i] > rMax) rMax = histR[i];
    if (histG[i] > gMax) gMax = histG[i];
    if (histB[i] > bMax) bMax = histB[i];
    if (histL[i] > lMax) lMax = histL[i];
  }
  if (rMax > 0) for (let i = 0; i < 256; i++) histR[i] /= rMax;
  if (gMax > 0) for (let i = 0; i < 256; i++) histG[i] /= gMax;
  if (bMax > 0) for (let i = 0; i < 256; i++) histB[i] /= bMax;
  if (lMax > 0) for (let i = 0; i < 256; i++) histL[i] /= lMax;

  // Pack histogram into one 256×4 array [R0,G0,B0,L0, R1,G1,B1,L1, ...]
  const histogram = new Float32Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    histogram[i * 4 + 0] = histR[i];
    histogram[i * 4 + 1] = histG[i];
    histogram[i * 4 + 2] = histB[i];
    histogram[i * 4 + 3] = histL[i];
  }

  self.postMessage(
    { waveform: waveform.buffer, vectorscope: vectorscope.buffer, histogram: histogram.buffer },
    [waveform.buffer, vectorscope.buffer, histogram.buffer]
  );
};
`

function makeWorker(): Worker {
  const blob = new Blob([WORKER_SRC], { type: "application/javascript" })
  return new Worker(URL.createObjectURL(blob))
}

// ─── public types ─────────────────────────────────────────────────────────────

export interface ScopeData {
  /** 256×256 normalised luma accumulator, row-major (row 0 = luma 0) */
  waveform: Float32Array
  /** 256×256 normalised Cb/Cr accumulator */
  vectorscope: Float32Array
  /** 256 bins × 4 channels [R,G,B,Luma] interleaved */
  histogram: Float32Array
}

export interface ColorScopesResult {
  data: ScopeData | null
  enabled: boolean
  setEnabled: (v: boolean) => void
  /** Call after each compositor draw to sample the current frame */
  sample: () => void
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useColorScopes(
  canvasRef: RefObject<HTMLCanvasElement | null>,
): ColorScopesResult {
  const [enabled, setEnabled] = useState(false)
  const [data, setData] = useState<ScopeData | null>(null)

  const workerRef  = useRef<Worker | null>(null)
  const busyRef    = useRef(false)   // drop frames while worker is busy
  const enabledRef = useRef(enabled)
  useEffect(() => { enabledRef.current = enabled }, [enabled])

  // Spawn / destroy worker with enabled state
  useEffect(() => {
    if (!enabled) {
      workerRef.current?.terminate()
      workerRef.current = null
      setData(null)
      return
    }
    const w = makeWorker()
    workerRef.current = w
    w.onmessage = (e) => {
      busyRef.current = false
      setData({
        waveform:    new Float32Array(e.data.waveform),
        vectorscope: new Float32Array(e.data.vectorscope),
        histogram:   new Float32Array(e.data.histogram),
      })
    }
    return () => {
      w.terminate()
      workerRef.current = null
    }
  }, [enabled])

  // Sample the compositor canvas on every store tick (scrub or playback)
  const sample = useCallback(() => {
    if (!enabledRef.current || busyRef.current || !workerRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Sample at reduced resolution for performance (max 320px wide)
    const scale = Math.min(1, 320 / canvas.width)
    const sw = Math.max(1, Math.round(canvas.width  * scale))
    const sh = Math.max(1, Math.round(canvas.height * scale))

    let imageData: ImageData
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    } catch {
      return
    }

    // Downsample via OffscreenCanvas if needed
    let pixels: Uint8ClampedArray
    if (scale < 1) {
      const off = new OffscreenCanvas(sw, sh)
      const offCtx = off.getContext("2d")!
      offCtx.drawImage(canvas, 0, 0, sw, sh)
      pixels = offCtx.getImageData(0, 0, sw, sh).data
    } else {
      pixels = imageData.data
    }

    busyRef.current = true
    // Transfer the buffer — worker owns it until it posts back
    const copy = new Uint8ClampedArray(pixels)
    workerRef.current.postMessage(
      { pixels: copy.buffer, width: sw, height: sh },
      [copy.buffer],
    )
  }, [canvasRef])

  return { data, enabled, setEnabled, sample }
}
