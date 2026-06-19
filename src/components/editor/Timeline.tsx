import { useRef, useState, useCallback } from "react"
import { useEditorStore } from "@/store/editorStore"
import type { TimelineClip } from "@/types/editor"

function Icon({ name, className = "size-4" }: { name: string; className?: string }) {
  const props = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className }
  switch (name) {
    case "scissors": return <svg {...props}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>
    case "plus": return <svg {...props}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
    case "zoom-in": return <svg {...props}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
    case "zoom-out": return <svg {...props}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
    default: return null
  }
}

const PIXEL_PER_SECOND = 50
const TRACK_HEIGHT = 48

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`
}

function ClipElement({ clip, zoom }: { clip: TimelineClip; zoom: number }) {
  const updateClip = useEditorStore((state) => state.updateClip)
  const selectClip = useEditorStore((state) => state.selectClip)
  const selectedClipId = useEditorStore((state) => state.selectedClipId)
  const deleteClip = useEditorStore((state) => state.deleteClip)
  
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<"left" | "right" | null>(null)
  const dragStartRef = useRef({ x: 0, startTime: 0, duration: 0 })

  const isSelected = selectedClipId === clip.id
  const width = clip.duration * PIXEL_PER_SECOND * zoom
  const left = clip.startTime * PIXEL_PER_SECOND * zoom

  const handleMouseDown = (e: React.MouseEvent, action: "drag" | "resize-left" | "resize-right") => {
    e.stopPropagation()
    selectClip(clip.id)
    
    if (action === "drag") {
      setIsDragging(true)
      dragStartRef.current = { x: e.clientX, startTime: clip.startTime, duration: clip.duration }
    } else {
      setIsResizing(action === "resize-left" ? "left" : "right")
      dragStartRef.current = { x: e.clientX, startTime: clip.startTime, duration: clip.duration }
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const delta = e.clientX - dragStartRef.current.x
    const timeDelta = delta / (PIXEL_PER_SECOND * zoom)

    if (isDragging) {
      const newStartTime = Math.max(0, dragStartRef.current.startTime + timeDelta)
      updateClip(clip.id, { startTime: newStartTime })
    } else if (isResizing === "left") {
      const newStartTime = Math.max(0, dragStartRef.current.startTime + timeDelta)
      const newDuration = dragStartRef.current.duration - timeDelta
      if (newDuration > 0.1) {
        updateClip(clip.id, { startTime: newStartTime, duration: newDuration, trimStart: clip.trimStart + timeDelta })
      }
    } else if (isResizing === "right") {
      const newDuration = Math.max(0.1, dragStartRef.current.duration + timeDelta)
      updateClip(clip.id, { duration: newDuration })
    }
  }, [isDragging, isResizing, clip.id, updateClip, zoom, clip.trimStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(null)
  }, [])

  useState(() => {
    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  })

  const getClipColor = () => {
    switch (clip.type) {
      case "video": return "oklch(0.55 0.18 280)"
      case "audio": return "oklch(0.6 0.15 180)"
      case "image": return "oklch(0.65 0.16 30)"
      case "text": return "oklch(0.55 0.14 140)"
      default: return "oklch(0.5 0.1 200)"
    }
  }

  return (
    <div
      className={`absolute rounded transition-all ${
        isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
      } ${isDragging || isResizing ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        height: `${TRACK_HEIGHT - 8}px`,
        background: getClipColor(),
        top: "4px",
      }}
      onMouseDown={(e) => handleMouseDown(e, "drag")}
      onDoubleClick={() => deleteClip(clip.id)}
    >
      {/* Resize handles */}
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/20 opacity-0 transition-opacity hover:opacity-100"
        onMouseDown={(e) => handleMouseDown(e, "resize-left")}
      />
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/20 opacity-0 transition-opacity hover:opacity-100"
        onMouseDown={(e) => handleMouseDown(e, "resize-right")}
      />
      
      {/* Clip content */}
      <div className="flex h-full items-center gap-1 overflow-hidden px-2">
        <div className="size-2 rounded-full bg-white/40" />
        <span className="truncate text-[10px] font-medium text-white">
          {clip.type} {formatTime(clip.duration)}
        </span>
      </div>
    </div>
  )
}

export function Timeline() {
  const timelineRef = useRef<HTMLDivElement>(null)
  const clips = useEditorStore((state) => state.clips)
  const currentTime = useEditorStore((state) => state.playback.currentTime)
  const duration = useEditorStore((state) => state.playback.duration)
  const seek = useEditorStore((state) => state.seek)
  const zoom = useEditorStore((state) => state.zoom)
  const setZoom = useEditorStore((state) => state.setZoom)
  const selectClip = useEditorStore((state) => state.selectClip)

  const tracks = [0, 1, 2, 3]
  const timelineWidth = Math.max(duration * PIXEL_PER_SECOND * zoom, 1000)

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left + (e.currentTarget.scrollLeft || 0)
      const time = x / (PIXEL_PER_SECOND * zoom)
      seek(time)
      selectClip(null)
    }
  }

  return (
    <div className="h-64 shrink-0 border-t border-border/60 bg-card/40">
      {/* Toolbar */}
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
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className="rounded p-1.5 text-foreground/70 hover:bg-muted"
          >
            <Icon name="zoom-out" />
          </button>
          <span className="px-2 text-[11px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            className="rounded p-1.5 text-foreground/70 hover:bg-muted"
          >
            <Icon name="zoom-in" />
          </button>
          <div className="mx-2 h-4 w-px bg-border" />
          <button className="rounded px-2 py-1 text-[11px] text-foreground/70 hover:bg-muted">
            <Icon name="scissors" className="mr-1 inline size-3" />
            Split
          </button>
          <button className="rounded px-2 py-1 text-[11px] text-foreground/70 hover:bg-muted">
            <Icon name="plus" className="mr-1 inline size-3" />
            Track
          </button>
        </div>
      </div>

      {/* Timeline tracks */}
      <div className="flex h-[calc(100%-2.5rem)] overflow-x-auto overflow-y-hidden">
        {/* Track labels */}
        <div className="flex w-20 shrink-0 flex-col border-r border-border/60 bg-card">
          {tracks.map((track) => (
            <div
              key={track}
              className="flex items-center justify-center border-b border-border/40 text-[10px] text-muted-foreground"
              style={{ height: `${TRACK_HEIGHT}px` }}
            >
              Track {track + 1}
            </div>
          ))}
        </div>

        {/* Timeline canvas */}
        <div 
          ref={timelineRef}
          className="relative flex-1"
          onClick={handleTimelineClick}
        >
          {/* Time ruler */}
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
                <span className="ml-1 text-[9px] text-muted-foreground">{i}s</span>
              </div>
            ))}
          </div>

          {/* Tracks */}
          <div 
            className="relative mt-6"
            style={{ width: `${timelineWidth}px`, height: `${tracks.length * TRACK_HEIGHT}px` }}
          >
            {tracks.map((track) => (
              <div
                key={track}
                className="relative border-b border-border/20"
                style={{ height: `${TRACK_HEIGHT}px` }}
              >
                {/* Grid lines */}
                {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full w-px bg-border/20"
                    style={{ left: `${i * PIXEL_PER_SECOND * zoom}px` }}
                  />
                ))}
                
                {/* Clips on this track */}
                {clips
                  .filter((clip) => clip.track === track)
                  .map((clip) => (
                    <ClipElement key={clip.id} clip={clip} zoom={zoom} />
                  ))}
              </div>
            ))}
          </div>

          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-0 z-10 w-0.5 bg-primary shadow-lg"
            style={{
              left: `${currentTime * PIXEL_PER_SECOND * zoom}px`,
              height: `${tracks.length * TRACK_HEIGHT + 24}px`,
            }}
          >
            <div className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}
