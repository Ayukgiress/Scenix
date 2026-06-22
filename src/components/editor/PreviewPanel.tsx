import { useRef, useEffect, useState, useMemo } from "react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"

function Icon({
  name,
  className = "size-5",
}: {
  name: string
  className?: string
}) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  }
  switch (name) {
    case "play":
      return (
        <svg {...props}>
          <polygon points="6 3 20 12 6 21 6 3" />
        </svg>
      )
    case "pause":
      return (
        <svg {...props}>
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
      )
    case "skip-back":
      return (
        <svg {...props}>
          <polygon points="19 20 9 12 19 4 19 20" />
          <line x1="5" y1="19" x2="5" y2="5" />
        </svg>
      )
    case "skip-forward":
      return (
        <svg {...props}>
          <polygon points="5 4 15 12 5 20 5 4" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      )
    case "fullscreen":
      return (
        <svg {...props}>
          <polyline points="9 3 3 3 3 9" />
          <polyline points="21 9 21 3 15 3" />
          <polyline points="3 21 3 15 9 15" />
          <polyline points="15 21 21 21 21 15" />
        </svg>
      )
    case "volume":
      return (
        <svg {...props}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )
    default:
      return null
  }
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "00:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function PreviewPanel() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isPlaying = useEditorStore((s) => s.playback.isPlaying)
  const currentTime = useEditorStore((s) => s.playback.currentTime)
  const duration = useEditorStore((s) => s.playback.duration)
  const volume = useEditorStore((s) => s.playback.volume)
  const playbackRate = useEditorStore((s) => s.playback.playbackRate)
  const clips = useEditorStore((s) => s.clips)
  const togglePlay = useEditorStore((s) => s.togglePlay)
  const pause = useEditorStore((s) => s.pause)
  const seek = useEditorStore((s) => s.seek)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const setVolume = useEditorStore((s) => s.setVolume)
  const selectClip = useEditorStore((s) => s.selectClip)

  const [hovering, setHovering] = useState(false)

  // Find the currently visible clip
  const activeClip = useMemo<LocalClip | null>(() => {
    return (
      clips.find(
        (c) =>
          currentTime >= c.startTime - 0.01 &&
          currentTime < c.startTime + c.duration,
      ) ?? null
    )
  }, [clips, currentTime])

  // Find audio clip that should be playing at this time (separate track)
  const activeAudioClip = useMemo<LocalClip | null>(() => {
    return (
      clips.find(
        (c) =>
          c.type === "audio" &&
          currentTime >= c.startTime - 0.01 &&
          currentTime < c.startTime + c.duration,
      ) ?? null
    )
  }, [clips, currentTime])

  // Sync video element with active clip
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!activeClip || !activeClip.url || activeClip.type !== "video") {
      // Clear src when nothing active
      if (video.src) {
        video.removeAttribute("src")
        video.load()
      }
      return
    }
    if (video.src !== activeClip.url) {
      video.src = activeClip.url
      video.load()
    }
    const clipTime = currentTime - activeClip.startTime + activeClip.trimStart
    if (Math.abs(video.currentTime - clipTime) > 0.15) {
      try {
        video.currentTime = Math.max(0, clipTime)
      } catch {
        /* video not ready yet */
      }
    }
    video.volume = activeClip.volume ?? 1
  }, [activeClip, currentTime])

  // Sync audio element with active audio clip
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!activeAudioClip || !activeAudioClip.url) {
      if (audio.src) {
        audio.removeAttribute("src")
        audio.load()
      }
      return
    }
    if (audio.src !== activeAudioClip.url) {
      audio.src = activeAudioClip.url
      audio.load()
    }
    const clipTime =
      currentTime - activeAudioClip.startTime + activeAudioClip.trimStart
    if (Math.abs(audio.currentTime - clipTime) > 0.15) {
      try {
        audio.currentTime = Math.max(0, clipTime)
      } catch {
        /* ignore */
      }
    }
    audio.volume = (activeAudioClip.volume ?? 1) * volume
  }, [activeAudioClip, currentTime, volume])

  // Drive playback via requestAnimationFrame for smooth frame-accurate updates
  useEffect(() => {
    if (!isPlaying) {
      videoRef.current?.pause()
      audioRef.current?.pause()
      return
    }

    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const next = useEditorStore.getState().playback.currentTime + dt
      if (duration > 0 && next >= duration) {
        pause()
        setCurrentTime(duration)
      } else {
        setCurrentTime(next)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    // Also tell media elements to play
    videoRef.current?.play().catch(() => {
      /* autoplay may be blocked, that's OK */
    })
    audioRef.current?.play().catch(() => {
      /* ignore */
    })

    return () => cancelAnimationFrame(raf)
  }, [isPlaying, duration, pause, setCurrentTime])

  // Apply playback rate
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  // Apply master volume to media element master gain via media element volume
  useEffect(() => {
    if (audioRef.current && !activeAudioClip) {
      audioRef.current.volume = volume
    }
  }, [volume, activeAudioClip])

  // Capture video duration when metadata loads so user has actual media duration
  const handleVideoLoaded = () => {
    if (!videoRef.current) return
    // We don't change total duration here - it depends on timeline clips
    // But we record the actual media length for trimming validation later
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    seek(pct * (duration || 0))
    selectClip(null)
  }

  const handleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

  const showControls = hovering || !isPlaying || clips.length === 0

  return (
    <section
      className="flex flex-1 flex-col bg-black/40 p-4"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        ref={containerRef}
        className="relative aspect-video w-full flex-1 overflow-hidden rounded-md border border-border/40 bg-black"
      >
        {/* Video element (hidden when no video clip active) */}
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain"
          playsInline
          onLoadedMetadata={handleVideoLoaded}
        />

        {/* Audio element (silent element used for audio clips) */}
        <audio ref={audioRef} className="hidden" />

        {/* Image overlay for image clips */}
        {activeClip?.type === "image" && activeClip.url && (
          <img
            src={activeClip.url}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}

        {/* Empty state */}
        {clips.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-center text-muted-foreground">
            <div>
              <p className="text-[13px] font-medium text-foreground">
                No clips on the timeline
              </p>
              <p className="mt-1 text-[11px]">
                Upload media and add clips to start editing
              </p>
            </div>
          </div>
        )}

        {/* Center play overlay */}
        <button
          onClick={togglePlay}
          className={`absolute inset-0 grid place-items-center transition-opacity ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="grid size-16 place-items-center rounded-full bg-background/90 text-foreground shadow-2xl backdrop-blur transition-transform hover:scale-110 active:scale-95">
            <Icon name={isPlaying ? "pause" : "play"} className="size-7" />
          </span>
        </button>

        {/* Time display */}
        <div className="absolute bottom-3 left-3 rounded bg-background/80 px-2 py-1 font-mono text-[11px] text-foreground backdrop-blur">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Fullscreen */}
        <button
          onClick={handleFullscreen}
          className="absolute bottom-3 right-3 grid size-8 place-items-center rounded bg-background/80 text-foreground backdrop-blur transition-opacity hover:bg-background"
          title="Fullscreen"
        >
          <Icon name="fullscreen" className="size-4" />
        </button>

        {/* Controls bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="group mb-3 h-1 w-full cursor-pointer rounded-full bg-white/20"
            onClick={handleSeek}
          >
            <div
              className="relative h-full rounded-full bg-primary transition-all"
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            >
              <div className="absolute right-0 top-1/2 size-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => seek(Math.max(0, currentTime - 5))}
              className="grid size-8 place-items-center rounded text-white transition-colors hover:bg-white/10"
              title="Back 5s"
            >
              <Icon name="skip-back" className="size-4" />
            </button>
            <button
              onClick={togglePlay}
              className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-110"
              title={isPlaying ? "Pause" : "Play"}
            >
              <Icon name={isPlaying ? "pause" : "play"} className="size-5" />
            </button>
            <button
              onClick={() => seek(Math.min(duration, currentTime + 5))}
              className="grid size-8 place-items-center rounded text-white transition-colors hover:bg-white/10"
              title="Forward 5s"
            >
              <Icon name="skip-forward" className="size-4" />
            </button>
            <div className="mx-2 flex items-center gap-1.5">
              <Icon name="volume" className="size-3 text-white" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="h-1 w-20 cursor-pointer accent-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
