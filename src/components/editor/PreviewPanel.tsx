import { useRef, useEffect, useState, useMemo, useCallback } from "react"
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Maximize2, Volume2, VolumeX
} from "lucide-react"
import { useEditorStore } from "@/store/editorStore"
import { useRealtimeCursors } from "@/hooks/useRealtimeCursors"
import { useCompositor } from "@/hooks/useCompositor"
import { useAudioMixer } from "@/hooks/useAudioMixer"
import { AudioMixerContext } from "@/context/AudioMixerContext"

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "00:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

const ASPECT_RATIOS: { label: string; value: "16/9" | "9/16" | "1/1" | "4/3" }[] = [
  { label: "16:9", value: "16/9" },
  { label: "9:16", value: "9/16" },
  { label: "1:1",  value: "1/1"  },
  { label: "4:3",  value: "4/3"  },
]

// Map aspect ratio string to [w, h] for canvas resolution
const AR_DIMS: Record<string, [number, number]> = {
  "16/9": [1280, 720],
  "9/16": [720, 1280],
  "1/1":  [720, 720],
  "4/3":  [960, 720],
}

export function PreviewPanel() {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)

  const isPlaying      = useEditorStore((s) => s.playback.isPlaying)
  const currentTime    = useEditorStore((s) => s.playback.currentTime)
  const duration       = useEditorStore((s) => s.playback.duration)
  const volume         = useEditorStore((s) => s.playback.volume)
  const playbackRate   = useEditorStore((s) => s.playback.playbackRate)
  const clips          = useEditorStore((s) => s.clips)
  const aspectRatio    = useEditorStore((s) => s.aspectRatio)
  const setAspectRatio = useEditorStore((s) => s.setAspectRatio)
  const togglePlay     = useEditorStore((s) => s.togglePlay)
  const seek           = useEditorStore((s) => s.seek)
  const setVolume      = useEditorStore((s) => s.setVolume)
  const setPlaybackRate = useEditorStore((s) => s.setPlaybackRate)
  const selectClip     = useEditorStore((s) => s.selectClip)

  const [hovering,  setHovering]  = useState(false)
  const [muted,     setMuted]     = useState(false)
  const [showRates, setShowRates] = useState(false)
  const [showAR,    setShowAR]    = useState(false)

  const remoteCursors = useRealtimeCursors()

  // ── canvas resolution follows aspect ratio ─────────────────────────────────
  const [canvasW, canvasH] = AR_DIMS[aspectRatio] ?? [1280, 720]

  // ── compositor ────────────────────────────────────────────────────────────
  const { videoError }          = useCompositor(canvasRef, { muted, volume })
  const { setSolo, insertEffect } = useAudioMixer({ muted, volume })

  // ── text / sticker overlays (DOM, unchanged from before) ──────────────────
  const activeTextClips = useMemo(
    () =>
      clips.filter(
        (c) =>
          c.type === "text" &&
          currentTime >= c.startTime - 0.05 &&
          currentTime < c.startTime + c.duration + 0.05,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clips, Math.floor(currentTime * 4)],
  )
  const activeStickerClips = useMemo(
    () =>
      clips.filter(
        (c) =>
          c.type === "sticker" &&
          currentTime >= c.startTime - 0.05 &&
          currentTime < c.startTime + c.duration + 0.05,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clips, Math.floor(currentTime * 4)],
  )

  // ── UI helpers ────────────────────────────────────────────────────────────
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * (duration || 0))
      selectClip(null)
    },
    [seek, selectClip, duration],
  )

  const stepFrame = (dir: 1 | -1) =>
    seek(Math.max(0, Math.min(duration, currentTime + dir * (1 / 30))))

  const handleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) el.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showRates && !showAR) return
    const handler = () => { setShowRates(false); setShowAR(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showRates, showAR])

  const showControls = hovering || !isPlaying || clips.length === 0

  return (
    <AudioMixerContext.Provider value={{ setSolo, insertEffect }}>
    <section
      className="relative h-full w-full bg-[#0a0a0c] overflow-hidden"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div ref={containerRef} className="absolute inset-0">

        {/* ── Compositor canvas ── */}
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: "contain" }}
        />

        {/* Text overlays */}
        {activeTextClips.map((tc) => {
          const td = {
            text: "Text", fontSize: 32, fontWeight: "bold",
            color: "#ffffff", x: 50, y: 80, fontFamily: "Inter",
            ...(tc.metadata ?? {}),
          } as { text: string; fontSize: number; fontWeight: string; color: string; x: number; y: number; fontFamily: string }
          const anim = tc.textAnimation
          const relTime = currentTime - tc.startTime
          const animProgress = anim && anim.type !== "none" && anim.duration > 0
            ? Math.min(1, Math.max(0, (relTime - anim.delay) / anim.duration))
            : 1

          let animStyle: React.CSSProperties = {}
          if (anim && anim.type !== "none") {
            if (anim.type === "fade-in") animStyle = { opacity: animProgress }
            else if (anim.type === "slide-up") animStyle = { opacity: animProgress, transform: `translate(-50%, calc(-50% + ${(1 - animProgress) * 40}px))` }
            else if (anim.type === "slide-down") animStyle = { opacity: animProgress, transform: `translate(-50%, calc(-50% - ${(1 - animProgress) * 40}px))` }
            else if (anim.type === "zoom-in") animStyle = { opacity: animProgress, transform: `translate(-50%, -50%) scale(${0.5 + animProgress * 0.5})` }
            else if (anim.type === "bounce") {
              const bounce = Math.abs(Math.sin(relTime * 8)) * (1 - animProgress) * 20
              animStyle = { transform: `translate(-50%, calc(-50% - ${bounce}px))` }
            } else if (anim.type === "typewriter") {
              const chars = Math.floor(animProgress * td.text.length)
              td.text = td.text.slice(0, chars)
            } else if (anim.type === "glitch") {
              const glitchX = animProgress < 1 ? (Math.random() - 0.5) * 8 : 0
              animStyle = { transform: `translate(calc(-50% + ${glitchX}px), -50%)`, filter: animProgress < 1 ? "hue-rotate(90deg)" : "none" }
            }
          }

          return (
            <div
              key={tc.id}
              className="pointer-events-none absolute"
              style={{ left: `${td.x}%`, top: `${td.y}%`, transform: "translate(-50%, -50%)", ...animStyle }}
            >
              <span
                className="rounded px-2 py-1 text-center whitespace-pre-wrap"
                style={{
                  fontSize: `${td.fontSize * 0.6}px`,
                  fontWeight: td.fontWeight,
                  color: td.color,
                  fontFamily: td.fontFamily,
                  textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                }}
              >
                {td.text}
              </span>
            </div>
          )
        })}

        {/* Sticker overlays */}
        {activeStickerClips.map((sc) => (
          <div
            key={sc.id}
            className="pointer-events-none absolute text-4xl"
            style={{
              left: `${sc.transforms?.x ?? 50}%`,
              top: `${sc.transforms?.y ?? 50}%`,
              transform: `translate(-50%, -50%) scale(${sc.transforms?.scale ?? 1}) rotate(${sc.transforms?.rotation ?? 0}deg)`,
              opacity: sc.transforms?.opacity ?? 1,
            }}
          >
            {sc.metadata?.text as string}
          </div>
        ))}

        {/* Empty state */}
        {clips.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-center text-muted-foreground">
            <div>
              <p className="text-[13px] font-medium text-foreground">No clips on the timeline</p>
              <p className="mt-1 text-[11px]">Upload media and add clips to start editing</p>
            </div>
          </div>
        )}

        {/* Video error */}
        {videoError && (
          <div className="absolute inset-x-0 top-2 mx-auto w-fit rounded bg-red-500/80 px-3 py-1 text-[11px] text-white">
            {videoError}
          </div>
        )}

        {/* Center play overlay */}
        <button
          onClick={togglePlay}
          className={`absolute inset-0 grid place-items-center transition-opacity ${showControls ? "opacity-100" : "opacity-0"}`}
        >
          <span className="grid size-16 place-items-center rounded-full bg-background/90 text-foreground shadow-2xl backdrop-blur transition-transform hover:scale-110 active:scale-95">
            {isPlaying ? <Pause className="size-7" /> : <Play className="size-7" />}
          </span>
        </button>

        {/* Time display */}
        <div className="absolute bottom-3 left-3 rounded bg-background/80 px-2 py-1 font-mono text-[11px] text-foreground backdrop-blur">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Aspect ratio picker */}
        <div className="absolute top-2 right-2">
          <button
            onClick={() => setShowAR((v) => !v)}
            className="rounded bg-background/70 px-2 py-0.5 text-[10px] font-medium text-foreground backdrop-blur hover:bg-background"
          >
            {ASPECT_RATIOS.find((r) => r.value === aspectRatio)?.label ?? "16:9"}
          </button>
          {showAR && (
            <div className="absolute right-0 top-full mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { setAspectRatio(r.value); setShowAR(false) }}
                  className={`block w-full px-3 py-1.5 text-left text-[11px] hover:bg-muted ${r.value === aspectRatio ? "text-primary font-medium" : "text-foreground"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fullscreen */}
        <button
          onClick={handleFullscreen}
          className="absolute bottom-3 right-3 grid size-8 place-items-center rounded bg-background/80 text-foreground backdrop-blur hover:bg-background"
          title="Fullscreen"
        >
          <Maximize2 className="size-4" />
        </button>

        {/* Controls bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity ${showControls ? "opacity-100" : "opacity-0"}`}
        >
          {/* Scrubber */}
          <div
            className="group relative mb-3 h-1.5 w-full cursor-pointer rounded-full bg-white/20"
            onClick={handleSeek}
          >
            <div
              className="relative h-full rounded-full bg-primary"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 size-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            {Array.from(remoteCursors.values()).map((cursor) => (
              <div
                key={cursor.userId}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${duration > 0 ? (cursor.currentTime / duration) * 100 : 0}%` }}
                title={cursor.name}
              >
                <div className="size-3 rounded-full border-2 border-white" style={{ background: cursor.color }} />
                <span
                  className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1 py-0.5 text-[8px] font-medium text-white"
                  style={{ background: cursor.color }}
                >
                  {cursor.name}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => seek(Math.max(0, currentTime - 5))} className="grid size-7 place-items-center rounded text-white hover:bg-white/10" title="Back 5s">
              <SkipBack className="size-3.5" />
            </button>
            <button onClick={() => stepFrame(-1)} className="grid size-7 place-items-center rounded text-white hover:bg-white/10" title="Previous frame (,)">
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              onClick={togglePlay}
              className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-110"
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <button onClick={() => stepFrame(1)} className="grid size-7 place-items-center rounded text-white hover:bg-white/10" title="Next frame (.)">
              <ChevronRight className="size-3.5" />
            </button>
            <button onClick={() => seek(Math.min(duration, currentTime + 5))} className="grid size-7 place-items-center rounded text-white hover:bg-white/10" title="Forward 5s">
              <SkipForward className="size-3.5" />
            </button>

            <div className="ml-1 flex items-center gap-1.5">
              <button
                onClick={() => setMuted((m) => !m)}
                className="grid size-6 place-items-center rounded text-white hover:bg-white/10"
                title={muted ? "Unmute (M)" : "Mute (M)"}
              >
                {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
              </button>
              <input
                type="range" min="0" max="1" step="0.01"
                value={muted ? 0 : volume}
                onChange={(e) => { setMuted(false); setVolume(parseFloat(e.target.value)) }}
                className="h-1 w-16 cursor-pointer accent-primary"
              />
            </div>

            <div className="relative ml-auto">
              <button
                onClick={() => setShowRates((v) => !v)}
                className="rounded px-2 py-0.5 text-[11px] font-medium text-white hover:bg-white/10"
              >
                {playbackRate}x
              </button>
              {showRates && (
                <div className="absolute bottom-full right-0 mb-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
                  {PLAYBACK_RATES.map((r) => (
                    <button
                      key={r}
                      onClick={() => { setPlaybackRate(r); setShowRates(false) }}
                      className={`block w-full px-3 py-1.5 text-left text-[11px] hover:bg-muted ${r === playbackRate ? "text-primary font-medium" : "text-foreground"}`}
                    >
                      {r}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
    </AudioMixerContext.Provider>
  )
}
