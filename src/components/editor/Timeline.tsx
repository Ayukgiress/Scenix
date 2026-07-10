import { useRef, useState, useCallback, useEffect } from "react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import { useRealtimeCursors } from "@/hooks/useRealtimeCursors"

const PIXEL_PER_SECOND = 50
const TRACK_HEIGHT = 52

const TRACK_CONFIG = [
  { label: "Video", icon: "video", color: "oklch(0.55 0.18 280)", type: "video" as const },
  { label: "Video 2", icon: "video", color: "oklch(0.52 0.16 260)", type: "video" as const },
  { label: "Text", icon: "text", color: "oklch(0.55 0.14 140)", type: "text" as const },
  { label: "Audio", icon: "audio", color: "oklch(0.52 0.18 160)", type: "audio" as const },
]

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`
}

function TrackIcon({ type }: { type: string }) {
  const cls = "size-3 shrink-0"
  if (type === "video")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <rect x="2" y="7" width="15" height="10" rx="2" />
        <path d="m17 9 5-2v10l-5-2" />
      </svg>
    )
  if (type === "audio")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    )
  if (type === "text")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    )
  return null
}

// Waveform bars rendered inside audio clips
function AudioWaveform({ width }: { width: number }) {
  const count = Math.max(4, Math.floor(width / 4))
  return (
    <div className="absolute inset-0 flex items-center gap-px overflow-hidden px-1">
      {Array.from({ length: count }, (_, i) => {
        const h = 20 + Math.abs(Math.sin(i * 1.7 + i * 0.3)) * 60
        return (
          <div
            key={i}
            className="w-0.5 shrink-0 rounded-full bg-white/50"
            style={{ height: `${h}%` }}
          />
        )
      })}
    </div>
  )
}

function ClipElement({ clip, zoom }: { clip: LocalClip; zoom: number }) {
  const updateClipLocal = useEditorStore((s) => s.updateClipLocal)
  const syncUpdateClip = useEditorStore((s) => s.syncUpdateClip)
  const selectClip = useEditorStore((s) => s.selectClip)
  const selectedClipId = useEditorStore((s) => s.selectedClipId)
  const syncDeleteClip = useEditorStore((s) => s.syncDeleteClip)
  const { accessToken } = useAuth()

  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<"left" | "right" | null>(null)
  const dragStartRef = useRef({ x: 0, startTime: 0, duration: 0, trimStart: 0 })

  const isSelected = selectedClipId === clip.id
  const width = Math.max(8, clip.duration * PIXEL_PER_SECOND * zoom)
  const left = clip.startTime * PIXEL_PER_SECOND * zoom
  const trackCfg = TRACK_CONFIG[clip.track] ?? TRACK_CONFIG[0]
  const bgColor = trackCfg.color

  const startDrag = (e: React.MouseEvent, action: "drag" | "resize-left" | "resize-right") => {
    e.stopPropagation()
    e.preventDefault()
    selectClip(clip.id)
    dragStartRef.current = {
      x: e.clientX, startTime: clip.startTime,
      duration: clip.duration, trimStart: clip.trimStart ?? 0,
    }
    if (action === "drag") setIsDragging(true)
    else setIsResizing(action === "resize-left" ? "left" : "right")
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const delta = e.clientX - dragStartRef.current.x
    const timeDelta = delta / (PIXEL_PER_SECOND * zoom)
    const token = accessToken

    if (isDragging) {
      const newStartTime = Math.max(0, dragStartRef.current.startTime + timeDelta)
      updateClipLocal(clip.id, { startTime: newStartTime })
      if (token) syncUpdateClip(clip.id, { startTime: newStartTime }, token)
    } else if (isResizing === "left") {
      const newStartTime = Math.max(0, dragStartRef.current.startTime + timeDelta)
      const newDuration = dragStartRef.current.duration - timeDelta
      if (newDuration > 0.1) {
        const newTrimStart = Math.max(0, dragStartRef.current.trimStart + timeDelta)
        updateClipLocal(clip.id, { startTime: newStartTime, duration: newDuration, trimStart: newTrimStart })
        if (token) syncUpdateClip(clip.id, { startTime: newStartTime, duration: newDuration, trimStart: newTrimStart }, token)
      }
    } else if (isResizing === "right") {
      const newDuration = Math.max(0.1, dragStartRef.current.duration + timeDelta)
      const newTrimEnd = (clip.trimEnd ?? dragStartRef.current.duration) + timeDelta
      updateClipLocal(clip.id, { duration: newDuration, trimEnd: newTrimEnd })
      if (token) syncUpdateClip(clip.id, { duration: newDuration, trimEnd: newTrimEnd }, token)
    }
  }, [isDragging, isResizing, clip.id, clip.trimEnd, updateClipLocal, syncUpdateClip, accessToken, zoom])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(null)
  }, [])

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

  // Parse text clip label
  let clipLabel = clip.type
  if (clip.type === "text" && clip.url) {
    try { clipLabel = JSON.parse(clip.url).text ?? "Text" } catch { clipLabel = "Text" }
  }

  return (
    <div
      data-clip
      className={`group absolute rounded-md transition-shadow ${
        isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-transparent shadow-lg" : "shadow-sm"
      } ${isDragging || isResizing ? "cursor-grabbing" : "cursor-grab"} ${clip.syncing ? "opacity-70" : ""}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        height: `${TRACK_HEIGHT - 10}px`,
        background: bgColor,
        top: "5px",
      }}
      onMouseDown={(e) => startDrag(e, "drag")}
    >
      {/* Resize handles */}
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l-md bg-white/20 opacity-0 transition-opacity hover:opacity-100"
        onMouseDown={(e) => startDrag(e, "resize-left")}
      />
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-md bg-white/20 opacity-0 transition-opacity hover:opacity-100"
        onMouseDown={(e) => startDrag(e, "resize-right")}
      />

      {/* Audio waveform */}
      {clip.type === "audio" && <AudioWaveform width={width} />}

      {/* Clip content */}
      <div className="relative flex h-full items-center gap-1 overflow-hidden px-2">
        <div className="size-1.5 shrink-0 rounded-full bg-white/50" />
        <span className="truncate text-[10px] font-medium text-white drop-shadow">
          {clipLabel}
        </span>
        <span className="ml-auto shrink-0 text-[9px] text-white/60">
          {formatTime(clip.duration)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (accessToken) syncDeleteClip(clip.id, accessToken)
          }}
          className="ml-0.5 rounded p-0.5 text-white/50 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100"
          title="Delete clip"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export function Timeline() {
  const timelineRef = useRef<HTMLDivElement>(null)
  const clips = useEditorStore((s) => s.clips)
  const currentTime = useEditorStore((s) => s.playback.currentTime)
  const duration = useEditorStore((s) => s.playback.duration)
  const seek = useEditorStore((s) => s.seek)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const selectClip = useEditorStore((s) => s.selectClip)
  const togglePlay = useEditorStore((s) => s.togglePlay)
  const isPlaying = useEditorStore((s) => s.playback.isPlaying)

  const remoteCursors = useRealtimeCursors()

  const visibleSeconds = Math.max(duration, 30)
  const timelineWidth = Math.max(visibleSeconds * PIXEL_PER_SECOND * zoom, 1000)
  const rulerHeight = 28
  const tracksHeight = TRACK_CONFIG.length * TRACK_HEIGHT

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest("[data-clip]") || target.closest("[data-track-label]")) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left + (e.currentTarget.scrollLeft || 0)
    seek(Math.max(0, x / (PIXEL_PER_SECOND * zoom)))
    selectClip(null)
  }

  useEffect(() => {
    const container = timelineRef.current?.parentElement
    if (!container) return
    const playheadX = currentTime * PIXEL_PER_SECOND * zoom
    const { scrollLeft, clientWidth } = container
    if (playheadX < scrollLeft + 40) {
      container.scrollLeft = Math.max(0, playheadX - 40)
    } else if (playheadX > scrollLeft + clientWidth - 40) {
      container.scrollLeft = playheadX - clientWidth + 40
    }
  }, [currentTime, zoom])

  return (
    <div className="flex shrink-0 flex-col border-t border-border/60 bg-[#0f0f11]" style={{ height: `${rulerHeight + tracksHeight + 40}px` }}>
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 bg-card/60 px-3">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            )}
          </button>

          <span className="rounded bg-muted px-2 py-1 font-mono text-[10px] text-foreground">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-muted-foreground">/</span>
          <span className="rounded bg-muted px-2 py-1 font-mono text-[10px] text-foreground">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(zoom - 0.25)}
            className="rounded p-1.5 text-foreground/70 hover:bg-muted"
            title="Zoom out"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <span className="w-10 text-center text-[11px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(zoom + 0.25)}
            className="rounded p-1.5 text-foreground/70 hover:bg-muted"
            title="Zoom in"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tracks area */}
      <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        {/* Track labels */}
        <div className="flex w-20 shrink-0 flex-col border-r border-border/60 bg-card/80" style={{ paddingTop: `${rulerHeight}px` }}>
          {TRACK_CONFIG.map((track, i) => (
            <div
              key={i}
              data-track-label
              className="flex items-center gap-1.5 border-b border-border/40 px-2 text-muted-foreground"
              style={{ height: `${TRACK_HEIGHT}px` }}
            >
              <TrackIcon type={track.icon} />
              <span className="text-[9px] font-medium">{track.label}</span>
            </div>
          ))}
        </div>

        {/* Scrollable timeline */}
        <div
          ref={timelineRef}
          className="relative flex-1"
          onClick={handleTimelineClick}
        >
          {/* Ruler */}
          <div
            className="sticky top-0 z-10 border-b border-border/40 bg-[#0f0f11]"
            style={{ width: `${timelineWidth}px`, height: `${rulerHeight}px` }}
          >
            {Array.from({ length: Math.ceil(visibleSeconds) + 1 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 flex h-full flex-col justify-end border-l border-border/30"
                style={{ left: `${i * PIXEL_PER_SECOND * zoom}px` }}
              >
                <span className="mb-1 ml-1 text-[9px] text-muted-foreground/70">{i}s</span>
              </div>
            ))}
            {/* Half-second ticks */}
            {Array.from({ length: Math.ceil(visibleSeconds * 2) + 1 }).map((_, i) => (
              i % 2 !== 0 && (
                <div
                  key={`h${i}`}
                  className="absolute bottom-0 h-1.5 w-px bg-border/20"
                  style={{ left: `${(i * 0.5) * PIXEL_PER_SECOND * zoom}px` }}
                />
              )
            ))}
          </div>

          {/* Track rows */}
          <div style={{ width: `${timelineWidth}px`, height: `${tracksHeight}px` }}>
            {TRACK_CONFIG.map((track, trackIdx) => (
              <div
                key={trackIdx}
                className="relative border-b border-border/20"
                style={{ height: `${TRACK_HEIGHT}px` }}
              >
                {/* Grid lines */}
                {Array.from({ length: Math.ceil(visibleSeconds) + 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full w-px bg-border/10"
                    style={{ left: `${i * PIXEL_PER_SECOND * zoom}px` }}
                  />
                ))}

                {/* Track type hint when empty */}
                {clips.filter((c) => c.track === trackIdx).length === 0 && (
                  <div className="pointer-events-none absolute inset-0 flex items-center px-3">
                    <span className="text-[9px] text-muted-foreground/30">
                      {track.label} track — drag clips here
                    </span>
                  </div>
                )}

                {clips
                  .filter((c) => c.track === trackIdx)
                  .map((clip) => (
                    <ClipElement key={clip.id} clip={clip} zoom={zoom} />
                  ))}
              </div>
            ))}
          </div>

          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-0 z-20 w-0.5 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
            style={{
              left: `${currentTime * PIXEL_PER_SECOND * zoom}px`,
              height: `${rulerHeight + tracksHeight}px`,
            }}
          >
            <div className="absolute -top-0 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-red-500" />
          </div>

          {/* Remote cursor playheads */}
          {Array.from(remoteCursors.values()).map((cursor) => (
            <div
              key={cursor.userId}
              className="pointer-events-none absolute top-0 z-20 w-0.5"
              style={{
                left: `${cursor.currentTime * PIXEL_PER_SECOND * zoom}px`,
                height: `${rulerHeight + tracksHeight}px`,
                background: cursor.color,
                opacity: 0.7,
              }}
            >
              <div
                className="absolute -top-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1 py-0.5 text-[8px] font-medium text-white"
                style={{ background: cursor.color }}
              >
                {cursor.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
