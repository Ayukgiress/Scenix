import { useRef, useEffect, useState } from "react"
import { useEditorStore } from "@/store/editorStore"
import { usePlaybackEngine } from "@/hooks/usePlaybackEngine"
import { Canvas } from "fabric"

function Icon({ name, className = "size-5" }: { name: string; className?: string }) {
  const props = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className }
  switch (name) {
    case "play": return <svg {...props}><polygon points="6 3 20 12 6 21 6 3" /></svg>
    case "pause": return <svg {...props}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
    case "skip-back": return <svg {...props}><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" /></svg>
    case "skip-forward": return <svg {...props}><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>
    default: return null
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function PreviewPanel() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas | null>(null)
  
  const isPlaying = useEditorStore((state) => state.playback.isPlaying)
  const currentTime = useEditorStore((state) => state.playback.currentTime)
  const duration = useEditorStore((state) => state.playback.duration)
  const clips = useEditorStore((state) => state.clips)
  const play = useEditorStore((state) => state.play)
  const pause = useEditorStore((state) => state.pause)
  const seek = useEditorStore((state) => state.seek)
  
  const [showControls, setShowControls] = useState(true)
  
  usePlaybackEngine(videoRef)

  // Initialize fabric canvas for overlays
  useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      fabricCanvasRef.current = new Canvas(canvasRef.current, {
        width: canvasRef.current.offsetWidth,
        height: canvasRef.current.offsetHeight,
        selection: false,
      })
    }
    return () => {
      fabricCanvasRef.current?.dispose()
    }
  }, [])

  // Render active clips at current time
  useEffect(() => {
    const activeClip = clips.find(
      (clip) => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration
    )

    if (activeClip && videoRef.current && activeClip.url) {
      if (videoRef.current.src !== activeClip.url) {
        videoRef.current.src = activeClip.url
      }
      const clipTime = currentTime - activeClip.startTime + activeClip.trimStart
      videoRef.current.currentTime = clipTime
    }
  }, [clips, currentTime])

  const togglePlayPause = () => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    seek(percent * duration)
  }

  return (
    <section 
      className="flex flex-1 flex-col bg-black/40 p-4"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="relative aspect-video w-full flex-1 overflow-hidden rounded-md border border-border/40 bg-black">
        {/* Video element */}
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain"
          playsInline
        />
        
        {/* Canvas overlay for text/stickers */}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {/* Play/Pause overlay */}
        <div 
          className={`absolute inset-0 grid place-items-center transition-opacity ${
            showControls || !clips.length ? "opacity-100" : "opacity-0"
          }`}
        >
          <button 
            onClick={togglePlayPause}
            className="grid size-16 place-items-center rounded-full bg-background/90 text-foreground shadow-2xl backdrop-blur transition-transform hover:scale-110 active:scale-95"
          >
            <Icon name={isPlaying ? "pause" : "play"} className="size-7" />
          </button>
        </div>

        {/* Time display */}
        <div className="absolute bottom-3 left-3 rounded bg-background/80 px-2 py-1 font-mono text-[11px] text-foreground backdrop-blur">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Controls bar */}
        <div 
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Progress bar */}
          <div 
            className="group mb-3 h-1 w-full cursor-pointer rounded-full bg-white/20"
            onClick={handleSeek}
          >
            <div 
              className="relative h-full rounded-full bg-primary transition-all"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 size-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => seek(Math.max(0, currentTime - 5))}
              className="grid size-8 place-items-center rounded text-white transition-colors hover:bg-white/10"
            >
              <Icon name="skip-back" className="size-4" />
            </button>
            <button 
              onClick={togglePlayPause}
              className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-110"
            >
              <Icon name={isPlaying ? "pause" : "play"} className="size-5" />
            </button>
            <button 
              onClick={() => seek(Math.min(duration, currentTime + 5))}
              className="grid size-8 place-items-center rounded text-white transition-colors hover:bg-white/10"
            >
              <Icon name="skip-forward" className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
