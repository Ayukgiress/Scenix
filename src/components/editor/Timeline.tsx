import { useRef, useState, useCallback, useEffect } from "react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"

const PIXEL_PER_SECOND = 50
const TRACK_HEIGHT = 48
const TRACKS = [0, 1, 2, 3]

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`
}

function getClipColor(type: LocalClip["type"]): string {
  switch (type) {
    case "video":
      return "oklch(0.55 0.18 280)"
    case "audio":
      return "oklch(0.6 0.15 180)"
    case "image":
      return "oklch(0.65 0.16 30)"
    case "text":
      return "oklch(0.55 0.14 140)"
    default:
      return "oklch(0.5 0.1 200)"
  }
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

  const startDrag = (
    e: React.MouseEvent,
    action: "drag" | "resize-left" | "resize-right",
  ) => {
    e.stopPropagation()
    e.preventDefault()
    selectClip(clip.id)
    dragStartRef.current = {
      x: e.clientX,
      startTime: clip.startTime,
      duration: clip.duration,
      trimStart: clip.trimStart ?? 0,
    }
    if (action === "drag") setIsDragging(true)
    else setIsResizing(action === "resize-left" ? "left" : "right")
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const delta = e.clientX - dragStartRef.current.x
      const timeDelta = delta / (PIXEL_PER_SECOND * zoom)
      const token = accessToken

      if (isDragging) {
        const newStartTime = Math.max(
          0,
          dragStartRef.current.startTime + timeDelta,
        )
        updateClipLocal(clip.id, { startTime: newStartTime })
        if (token) syncUpdateClip(clip.id, { startTime: newStartTime }, token)
      } else if (isResizing === "left") {
        const newStartTime = Math.max(
          0,
          dragStartRef.current.startTime + timeDelta,
        )
        const newDuration = dragStartRef.current.duration - timeDelta
        if (newDuration > 0.1) {
          const newTrimStart = Math.max(
            0,
            dragStartRef.current.trimStart + timeDelta,
          )
          updateClipLocal(clip.id, {
            startTime: newStartTime,
            duration: newDuration,
            trimStart: newTrimStart,
          })
          if (token) {
            syncUpdateClip(
              clip.id,
              {
                startTime: newStartTime,
                duration: newDuration,
                trimStart: newTrimStart,
              },
              token,
            )
          }
        }
      } else if (isResizing === "right") {
        const newDuration = Math.max(
          0.1,
          dragStartRef.current.duration + timeDelta,
        )
        const newTrimEnd = (clip.trimEnd ?? dragStartRef.current.duration) + timeDelta
        updateClipLocal(clip.id, {
          duration: newDuration,
          trimEnd: newTrimEnd,
        })
        if (token) {
          syncUpdateClip(
            clip.id,
            {
              duration: newDuration,
              trimEnd: newTrimEnd,
            },
            token,
          )
        }
      }
    },
    [
      isDragging,
      isResizing,
      clip.id,
      clip.trimEnd,
      updateClipLocal,
      syncUpdateClip,
      accessToken,
      zoom,
    ],
  )

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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (accessToken) syncDeleteClip(clip.id, accessToken)
  }

  return (
    <div
      className={`group absolute rounded transition-shadow ${
        isSelected
          ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
          : ""
      } ${isDragging || isResizing ? "cursor-grabbing" : "cursor-grab"} ${clip.syncing ? "opacity-70" : ""}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        height: `${TRACK_HEIGHT - 8}px`,
        background: getClipColor(clip.type),
        top: "4px",
      }}
      onMouseDown={(e) => startDrag(e, "drag")}
    >
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/20 opacity-0 transition-opacity hover:opacity-100"
        onMouseDown={(e) => startDrag(e, "resize-left")}
      />
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/20 opacity-0 transition-opacity hover:opacity-100"
        onMouseDown={(e) => startDrag(e, "resize-right")}
      />

      <div className="flex h-full items-center gap-1 overflow-hidden px-2">
        <div className="size-2 shrink-0 rounded-full bg-white/40" />
        <span className="truncate text-[10px] font-medium text-white">
          {clip.type} {formatTime(clip.duration)}
        </span>
        <button
          onClick={handleDelete}
          className="ml-auto rounded p-0.5 text-white/60 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100"
          title="Delete clip"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

  const timelineWidth = Math.max(duration * PIXEL_PER_SECOND * zoom, 1000)

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left + (e.currentTarget.scrollLeft || 0)
    const time = x / (PIXEL_PER_SECOND * zoom)
    seek(time)
    selectClip(null)
  }

  // Auto-scroll to keep playhead in view
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
    <div className="flex h-64 shrink-0 flex-col border-t border-border/60 bg-card/40">
      <div className="flex h-10 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-center gap-2">
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <span className="px-2 text-[11px] text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(zoom + 0.25)}
            className="rounded p-1.5 text-foreground/70 hover:bg-muted"
            title="Zoom in"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex w-20 shrink-0 flex-col border-r border-border/60 bg-card">
          {TRACKS.map((track) => (
            <div
              key={track}
              className="flex items-center justify-center border-b border-border/40 text-[10px] text-muted-foreground"
              style={{ height: `${TRACK_HEIGHT}px` }}
            >
              Track {track + 1}
            </div>
          ))}
        </div>

        <div
          ref={timelineRef}
          className="relative flex-1"
          onClick={handleTimelineClick}
        >
          <div
            className="absolute left-0 right-0 top-0 h-6 border-b border-border/40 bg-card/60"
            style={{ width: `${timelineWidth}px` }}
          >
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full border-l border-border/40"
                style={{ left: `${i * PIXEL_PER_SECOND * zoom}px` }}
              >
                <span className="ml-1 text-[9px] text-muted-foreground">
                  {i}s
                </span>
              </div>
            ))}
          </div>

          <div
            className="relative mt-6"
            style={{
              width: `${timelineWidth}px`,
              height: `${TRACKS.length * TRACK_HEIGHT}px`,
            }}
          >
            {TRACKS.map((track) => (
              <div
                key={track}
                className="relative border-b border-border/20"
                style={{ height: `${TRACK_HEIGHT}px` }}
              >
                {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full w-px bg-border/20"
                    style={{ left: `${i * PIXEL_PER_SECOND * zoom}px` }}
                  />
                ))}

                {clips
                  .filter((clip) => clip.track === track)
                  .map((clip) => (
                    <ClipElement key={clip.id} clip={clip} zoom={zoom} />
                  ))}
              </div>
            ))}
          </div>

          <div
            className="pointer-events-none absolute top-0 z-10 w-0.5 bg-primary shadow-lg"
            style={{
              left: `${currentTime * PIXEL_PER_SECOND * zoom}px`,
              height: `${TRACKS.length * TRACK_HEIGHT + 24}px`,
            }}
          >
            <div className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}