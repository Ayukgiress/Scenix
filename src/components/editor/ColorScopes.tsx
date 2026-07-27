import { useEffect, useRef, useState } from "react"
import type { ScopeData } from "@/hooks/useColorScopes"

// ─── Waveform renderer ────────────────────────────────────────────────────────
// Draws a luma waveform: x = horizontal position in frame, y = luma level.
// Bright pixels = many samples at that luma/column combination.

function WaveformScope({ data }: { data: ScopeData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const W = canvas.width   // 256
    const H = canvas.height  // 256

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = "#0a0a0c"
    ctx.fillRect(0, 0, W, H)

    // IRE grid lines at 0%, 25%, 50%, 75%, 100%
    ctx.strokeStyle = "rgba(255,255,255,0.08)"
    ctx.lineWidth = 1
    for (const pct of [0, 0.25, 0.5, 0.75, 1]) {
      const y = H - 1 - Math.round(pct * (H - 1))
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }

    // Waveform pixels — map normalised value to green brightness
    const img = ctx.createImageData(W, H)
    const { waveform } = data
    for (let row = 0; row < H; row++) {
      // row 0 = luma 0 (bottom of scope), flip for display
      const srcRow = H - 1 - row
      for (let col = 0; col < W; col++) {
        const v = waveform[srcRow * W + col]
        if (v <= 0) continue
        const brightness = Math.min(255, Math.round(v * 220 + 35))
        const idx = (row * W + col) * 4
        img.data[idx + 0] = 0
        img.data[idx + 1] = brightness
        img.data[idx + 2] = Math.round(brightness * 0.4)
        img.data[idx + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)

    // IRE labels
    ctx.fillStyle = "rgba(255,255,255,0.35)"
    ctx.font = "8px monospace"
    for (const [pct, label] of [[0, "0"], [0.5, "50"], [1, "100"]] as [number, string][]) {
      const y = H - 1 - Math.round(pct * (H - 1))
      ctx.fillText(label, 2, y - 2)
    }
  }, [data])

  return (
    <canvas
      ref={canvasRef}
      width={256}
      height={256}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  )
}

// ─── Vectorscope renderer ─────────────────────────────────────────────────────
// Draws a Cb/Cr (YCbCr) vectorscope. The centre is neutral grey.
// Colour targets for saturated primaries/secondaries are marked.

const VECTOR_TARGETS: { label: string; cb: number; cr: number; color: string }[] = [
  { label: "R",  cb:  90, cr: 240, color: "#f44" },
  { label: "G",  cb:  54, cr:  34, color: "#4f4" },
  { label: "B",  cb: 240, cr: 110, color: "#44f" },
  { label: "Cy", cb: 166, cr:  16, color: "#4ff" },
  { label: "Mg", cb: 202, cr: 222, color: "#f4f" },
  { label: "Yl", cb:  16, cr: 146, color: "#ff4" },
]

function VectorscopeScope({ data }: { data: ScopeData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const S = canvas.width  // 256

    ctx.clearRect(0, 0, S, S)
    ctx.fillStyle = "#0a0a0c"
    ctx.fillRect(0, 0, S, S)

    // Outer circle
    ctx.strokeStyle = "rgba(255,255,255,0.1)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2)
    ctx.stroke()

    // Cross-hair
    ctx.strokeStyle = "rgba(255,255,255,0.07)"
    ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.stroke()

    // Vectorscope pixels — map normalised value to cyan/green hue
    const img = ctx.createImageData(S, S)
    const { vectorscope } = data
    for (let i = 0; i < S * S; i++) {
      const v = vectorscope[i]
      if (v <= 0) continue
      const brightness = Math.min(255, Math.round(v * 200 + 55))
      const idx = i * 4
      img.data[idx + 0] = 0
      img.data[idx + 1] = brightness
      img.data[idx + 2] = Math.round(brightness * 0.8)
      img.data[idx + 3] = 255
    }
    ctx.putImageData(img, 0, 0)

    // Colour target boxes
    for (const t of VECTOR_TARGETS) {
      const x = t.cb
      const y = 255 - t.cr
      ctx.strokeStyle = t.color
      ctx.lineWidth = 1
      ctx.strokeRect(x - 3, y - 3, 6, 6)
      ctx.fillStyle = t.color
      ctx.font = "7px monospace"
      ctx.fillText(t.label, x + 4, y + 3)
    }
  }, [data])

  return (
    <canvas
      ref={canvasRef}
      width={256}
      height={256}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  )
}

// ─── RGB Histogram renderer ───────────────────────────────────────────────────
// Draws overlapping R, G, B, and Luma curves on a dark background.

function HistogramScope({ data }: { data: ScopeData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const W = canvas.width   // 256
    const H = canvas.height  // 128

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = "#0a0a0c"
    ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)"
    ctx.lineWidth = 1
    for (const x of [64, 128, 192]) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (const pct of [0.25, 0.5, 0.75]) {
      const y = H - Math.round(pct * H)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    const { histogram } = data

    // Draw each channel as a filled path
    const channels: { offset: number; color: string }[] = [
      { offset: 3, color: "rgba(255,255,255,0.25)" }, // Luma (drawn first, underneath)
      { offset: 0, color: "rgba(255,60,60,0.55)"   }, // R
      { offset: 1, color: "rgba(60,220,60,0.55)"   }, // G
      { offset: 2, color: "rgba(60,120,255,0.55)"  }, // B
    ]

    for (const { offset, color } of channels) {
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (let i = 0; i < 256; i++) {
        const v = histogram[i * 4 + offset]
        const x = (i / 255) * W
        const y = H - v * (H - 2)
        if (i === 0) ctx.lineTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.lineTo(W, H)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
    }
  }, [data])

  return (
    <canvas
      ref={canvasRef}
      width={256}
      height={128}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

type ScopeTab = "waveform" | "vectorscope" | "histogram"

const TABS: { id: ScopeTab; label: string }[] = [
  { id: "waveform",    label: "Waveform"    },
  { id: "vectorscope", label: "Vectorscope" },
  { id: "histogram",   label: "Histogram"   },
]

export function ColorScopes({ data }: { data: ScopeData | null }) {
  const [tab, setTab] = useState<ScopeTab>("waveform")

  return (
    <div className="flex flex-col bg-[#0a0a0c] border-t border-border/40">
      {/* Tab bar */}
      <div className="flex h-7 shrink-0 items-center gap-0.5 border-b border-border/40 px-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              tab === t.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-[9px] text-muted-foreground/40 pr-1">
          real-time
        </span>
      </div>

      {/* Scope canvas area */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: tab === "histogram" ? "80px" : "160px" }}
      >
        {!data ? (
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-[10px] text-muted-foreground/40">
              No frame data
            </span>
          </div>
        ) : (
          <>
            {tab === "waveform"    && <WaveformScope    data={data} />}
            {tab === "vectorscope" && <VectorscopeScope data={data} />}
            {tab === "histogram"   && <HistogramScope   data={data} />}
          </>
        )}
      </div>
    </div>
  )
}
