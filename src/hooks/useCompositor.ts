import { useEffect, useRef, useCallback } from "react"
import type { RefObject } from "react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import { interpolateKeyframes } from "@/components/editor/KeyframePanel"
import { colorGradeToFilter } from "@/components/editor/ColorGradePanel"

// ─── helpers ─────────────────────────────────────────────────────────────────

function isVisual(c: LocalClip) {
  return c.type === "video" || c.type === "image"
}

function isActive(c: LocalClip, t: number) {
  return t >= c.startTime - 0.05 && t < c.startTime + c.duration + 0.05
}

function clipTime(c: LocalClip, t: number) {
  return Math.max(0, t - c.startTime + (c.trimStart ?? 0))
}

function buildFilter(c: LocalClip): string {
  const meta = (c.metadata?.filter as string) ?? ""
  const grade = c.colorGrade ? colorGradeToFilter(c.colorGrade) : ""
  return [meta, grade].filter(Boolean).join(" ") || "none"
}

function resolveOpacity(c: LocalClip, t: number): number {
  if (c.keyframes?.length) {
    return interpolateKeyframes(c.keyframes, "opacity", t - c.startTime, c.opacity ?? 1)
  }
  return c.opacity ?? 1
}

function transitionAlpha(c: LocalClip, t: number): number {
  const tr = c.transition
  if (!tr || tr.type === "none") return 1
  const dur = Math.max(0.01, tr.duration)
  if (tr.position === "in" || tr.position === "both") {
    const p = (t - c.startTime) / dur
    if (p < 1) return Math.max(0, Math.min(1, p))
  }
  if (tr.position === "out" || tr.position === "both") {
    const p = (c.startTime + c.duration - t) / dur
    if (p < 1) return Math.max(0, Math.min(1, p))
  }
  return 1
}

// ─── chroma key ──────────────────────────────────────────────────────────────

function applyChromaKey(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  hexColor: string,
  tolerance: number,
  smoothing: number,
) {
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  let imageData: ImageData
  try { imageData = ctx.getImageData(x, y, w, h) } catch { return }
  const d = imageData.data
  const tol = tolerance * 441
  const smooth = Math.max(0.001, smoothing) * 441
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)
    if (dist < tol) d[i + 3] = 0
    else if (dist < tol + smooth) d[i + 3] = Math.round(((dist - tol) / smooth) * 255)
  }
  ctx.putImageData(imageData, x, y)
}

// ─── element pool ─────────────────────────────────────────────────────────────

type PoolEntry =
  | { kind: "video"; el: HTMLVideoElement; loadedUrl: string }
  | { kind: "image"; el: HTMLImageElement; loadedUrl: string }

// ─── offscreen canvas pool ────────────────────────────────────────────────────
// One reusable offscreen canvas per clip — resized as needed.
// Used to render a clip in isolation (filter applied to source only) before
// alpha-compositing the result onto the main canvas.  This prevents filter
// bleed and ensures globalAlpha multiplies the already-filtered pixels rather
// than the raw source pixels.

type OffscreenEntry = { canvas: OffscreenCanvas | HTMLCanvasElement; w: number; h: number }

function getOffscreen(
  pool: Map<string, OffscreenEntry>,
  id: string,
  w: number,
  h: number,
): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D } | null {
  let entry = pool.get(id)
  if (!entry || entry.w !== w || entry.h !== h) {
    let canvas: OffscreenCanvas | HTMLCanvasElement
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(w, h)
    } else {
      canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
    }
    entry = { canvas, w, h }
    pool.set(id, entry)
  }
  const ctx = entry.canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
  if (!ctx) return null
  return { canvas: entry.canvas, ctx }
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface CompositorOptions {
  muted: boolean
  volume: number
}

export interface CompositorResult {
  videoError: string | null
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useCompositor(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: CompositorOptions,
): CompositorResult {
  const pool        = useRef<Map<string, PoolEntry>>(new Map())
  const offscreens  = useRef<Map<string, OffscreenEntry>>(new Map())
  const optionsRef  = useRef(options)
  useEffect(() => { optionsRef.current = options }, [options])

  // ── draw one frame ──────────────────────────────────────────────────────────
  //
  // Compositing model (bottom → top):
  //   1. clearRect — transparent black
  //   2. For each active clip sorted by (track ASC, zIndex ASC):
  //      a. Compute destination rect and final opacity
  //      b. If the clip has a CSS filter OR opacity < 1:
  //           - Draw the source into an offscreen canvas at full opacity with
  //             the filter applied.  This isolates the filter to the clip's own
  //             pixels.
  //           - Composite the offscreen canvas onto the main canvas with
  //             globalAlpha = finalOpacity.
  //         Else (no filter, full opacity):
  //           - Draw directly onto the main canvas (fast path).
  //      c. Chroma key pass on the destination region (reads composited pixels).
  //
  // Track ordering: lower track index = drawn first = underneath.
  // zIndex breaks ties within the same track.

  const drawFrame = useCallback((
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    clips: LocalClip[],
    t: number,
  ) => {
    ctx.clearRect(0, 0, cw, ch)

    const active = clips
      .filter((c) => isVisual(c) && isActive(c, t))
      .sort((a, b) => a.track !== b.track ? a.track - b.track : (a.zIndex ?? 0) - (b.zIndex ?? 0))

    for (const clip of active) {
      const entry = pool.current.get(clip.id)
      if (!entry) continue

      // Destination rect — x/y are % of canvas; width/height are px or full canvas
      const dx = ((clip.x ?? 0) / 100) * cw
      const dy = ((clip.y ?? 0) / 100) * ch
      const dw = clip.width  != null ? clip.width  : cw
      const dh = clip.height != null ? clip.height : ch

      if (dw <= 0 || dh <= 0) continue

      const opacity = Math.max(0, Math.min(1, resolveOpacity(clip, t) * transitionAlpha(clip, t)))
      const filter  = buildFilter(clip)
      const hasFilter = filter !== "none"

      // ── rotation transform (applied to main canvas, not offscreen) ─────────
      const needsRotation = !!clip.rotation

      // ── fast path: no filter, full opacity, no rotation ───────────────────
      if (!hasFilter && opacity >= 1 && !needsRotation) {
        try {
          if (entry.kind === "video") {
            if (entry.el.readyState >= 2) ctx.drawImage(entry.el, dx, dy, dw, dh)
          } else {
            ctx.drawImage(entry.el, dx, dy, dw, dh)
          }
        } catch { /* element not ready */ }

        if (clip.chromaKey?.enabled && clip.chromaKey.color) {
          applyChromaKey(ctx, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh),
            clip.chromaKey.color, clip.chromaKey.tolerance, clip.chromaKey.smoothing)
        }
        continue
      }

      // ── compositing path: render clip into offscreen canvas first ──────────
      //
      // Step 1: draw source into offscreen at native dest size with filter.
      //         The offscreen canvas is always the same size as the destination
      //         rect so drawImage maps 1:1 and getImageData regions align.
      const off = getOffscreen(offscreens.current, clip.id, Math.round(dw), Math.round(dh))
      if (!off) continue
      const { canvas: offCanvas, ctx: offCtx } = off

      offCtx.clearRect(0, 0, Math.round(dw), Math.round(dh))
      offCtx.filter = filter
      try {
        if (entry.kind === "video") {
          if (entry.el.readyState >= 2) offCtx.drawImage(entry.el, 0, 0, Math.round(dw), Math.round(dh))
        } else {
          offCtx.drawImage(entry.el, 0, 0, Math.round(dw), Math.round(dh))
        }
      } catch { /* element not ready */ }
      offCtx.filter = "none"

      // Chroma key on the offscreen canvas (before compositing onto main)
      if (clip.chromaKey?.enabled && clip.chromaKey.color) {
        applyChromaKey(
          offCtx as CanvasRenderingContext2D,
          0, 0, Math.round(dw), Math.round(dh),
          clip.chromaKey.color, clip.chromaKey.tolerance, clip.chromaKey.smoothing,
        )
      }

      // Step 2: composite offscreen onto main canvas with final opacity + rotation
      ctx.save()
      ctx.globalAlpha = opacity

      if (needsRotation) {
        const cx = dx + dw / 2
        const cy = dy + dh / 2
        ctx.translate(cx, cy)
        ctx.rotate((clip.rotation! * Math.PI) / 180)
        ctx.translate(-cx, -cy)
      }

      try {
        ctx.drawImage(offCanvas as CanvasImageSource, dx, dy, dw, dh)
      } catch { /* not ready */ }

      ctx.restore()
    }
  }, [])

  // ── sync element pool ───────────────────────────────────────────────────────

  const syncPool = useCallback((clips: LocalClip[], t: number) => {
    const activeIds = new Set(
      clips.filter((c) => isVisual(c) && isActive(c, t)).map((c) => c.id),
    )

    for (const [id, entry] of pool.current) {
      if (!activeIds.has(id)) {
        if (entry.kind === "video") entry.el.pause()
        pool.current.delete(id)
        offscreens.current.delete(id)
      }
    }

    for (const clip of clips) {
      if (!isVisual(clip) || !isActive(clip, t)) continue
      const url = clip.url ?? ""
      if (!url) continue

      const existing = pool.current.get(clip.id)

      if (clip.type === "video") {
        if (!existing || existing.kind !== "video") {
          const vid = document.createElement("video")
          vid.muted = true
          vid.playsInline = true
          vid.preload = "auto"
          vid.crossOrigin = "anonymous"
          vid.src = url
          pool.current.set(clip.id, { kind: "video", el: vid, loadedUrl: url })
        } else if (existing.loadedUrl !== url) {
          existing.el.pause()
          existing.el.src = url
          existing.loadedUrl = url
          offscreens.current.delete(clip.id)
        }
      } else if (clip.type === "image") {
        if (!existing || existing.kind !== "image") {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.src = url
          pool.current.set(clip.id, { kind: "image", el: img, loadedUrl: url })
        } else if (existing.loadedUrl !== url) {
          existing.el.src = url
          existing.loadedUrl = url
          offscreens.current.delete(clip.id)
        }
      }
    }
  }, [])

  // ── seek all active video elements ─────────────────────────────────────────

  const seekAll = useCallback((clips: LocalClip[], t: number) => {
    for (const clip of clips) {
      if (clip.type !== "video" || !isActive(clip, t)) continue
      const entry = pool.current.get(clip.id)
      if (!entry || entry.kind !== "video") continue
      const vid = entry.el
      const ct = clipTime(clip, t)
      if (Math.abs(vid.currentTime - ct) > 0.15) {
        try { vid.currentTime = ct } catch { /* not ready */ }
      }
    }
  }, [])

  // ── main effect ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Scrub path: store subscription redraws on every seek/pause state change
    const unsub = useEditorStore.subscribe((state) => {
      const { clips, playback } = state
      const { currentTime, isPlaying } = playback
      if (isPlaying) return  // RAF loop handles playback frames

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      syncPool(clips, currentTime)
      seekAll(clips, currentTime)

      requestAnimationFrame(() => {
        drawFrame(ctx, canvas.width, canvas.height, clips, currentTime)
      })
    })

    // RAF loop
    let rafId = 0
    let alive = true
    let lastTs: number | null = null

    const step = (now: number) => {
      if (!alive) return

      const store = useEditorStore.getState()
      const { clips, playback } = store
      const { isPlaying, currentTime, duration, playbackRate } = playback

      if (!isPlaying) {
        lastTs = null
        rafId = requestAnimationFrame(step)
        return
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) { rafId = requestAnimationFrame(step); return }

      // Sync pool every frame so newly-entering clips get pool entries
      syncPool(clips, currentTime)

      // Advance time — primary video (lowest track) as clock source
      const dt = lastTs !== null ? (now - lastTs) / 1000 : 0
      const primaryClip = clips
        .filter((c) => c.type === "video" && isActive(c, currentTime))
        .sort((a, b) => a.track - b.track)[0]
      const primaryEntry = primaryClip ? pool.current.get(primaryClip.id) : undefined

      let next: number
      if (primaryEntry?.kind === "video") {
        const vid = primaryEntry.el
        next = (!vid.paused && vid.readyState >= 2)
          ? vid.currentTime - (primaryClip!.trimStart ?? 0) + primaryClip!.startTime
          : currentTime + dt * playbackRate
      } else {
        next = currentTime + dt * playbackRate
      }
      lastTs = now

      if (duration > 0 && next >= duration) {
        store.pause()
        store.setCurrentTime(duration)
        for (const [, entry] of pool.current) {
          if (entry.kind === "video") entry.el.pause()
        }
        drawFrame(ctx, canvas.width, canvas.height, clips, duration)
        return
      }

      store.setCurrentTime(next)

      // Drive all active video elements — not just the primary clock source
      for (const clip of clips) {
        if (clip.type !== "video" || !isActive(clip, next)) continue
        const entry = pool.current.get(clip.id)
        if (!entry || entry.kind !== "video") continue
        const vid = entry.el
        vid.playbackRate = playbackRate * (clip.speed ?? 1)

        // Resync non-primary videos that have drifted from the playhead
        if (clip.id !== primaryClip?.id) {
          const ct = clipTime(clip, next)
          if (Math.abs(vid.currentTime - ct) > 0.3) {
            try { vid.currentTime = ct } catch { /* not ready */ }
          }
        }

        if (vid.paused && vid.readyState >= 2) {
          vid.play().catch((e) => { if (e.name !== "AbortError") console.warn("compositor play:", e) })
        }
      }

      drawFrame(ctx, canvas.width, canvas.height, clips, next)
      rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      unsub()
      for (const [, entry] of pool.current) {
        if (entry.kind === "video") entry.el.pause()
      }
      pool.current.clear()
      offscreens.current.clear()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, drawFrame, seekAll, syncPool])

  return { videoError: null }
}
