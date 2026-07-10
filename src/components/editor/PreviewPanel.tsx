import { useRef, useEffect, useState, useMemo } from "react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import { useRealtimeCursors } from "@/hooks/useRealtimeCursors"

function Icon({ name, className = "size-5" }: { name: string; className?: string }) {
  const props = {
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className,
  }
  switch (name) {
    case "play": return <svg {...props}><polygon points="6 3 20 12 6 21 6 3" /></svg>
    case "pause": return <svg {...props}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
    case "skip-back": return <svg {...props}><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" /></svg>
    case "skip-forward": return <svg {...props}><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>
    case "frame-back": return <svg {...props}><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></svg>
    case "frame-forward": return <svg {...props}><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></svg>
    case "fullscreen": return <svg {...props}><polyline points="9 3 3 3 3 9" /><polyline points="21 9 21 3 15 3" /><polyline points="3 21 3 15 9 15" /><polyline points="15 21 21 21 21 15" /></svg>
    case "volume": return <svg {...props}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
    case "mute": return <svg {...props}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
    default: return null
  }
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "00:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

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
  const seek = useEditorStore((s) => s.seek)
  const setVolume = useEditorStore((s) => s.setVolume)
  const setPlaybackRate = useEditorStore((s) => s.setPlaybackRate)
  const selectClip = useEditorStore((s) => s.selectClip)

  const [hovering, setHovering] = useState(false)
  const [muted, setMuted] = useState(false)
  const [showRates, setShowRates] = useState(false)

  const remoteCursors = useRealtimeCursors()

  // Active video/image clip
  const activeClip = useMemo<LocalClip | null>(() => {
    return clips.find(
      (c) => c.type !== "audio" && c.type !== "text" &&
        currentTime >= c.startTime - 0.01 && currentTime < c.startTime + c.duration,
    ) ?? null
  }, [clips, currentTime])

  // Active text clips
  const activeTextClips = useMemo<LocalClip[]>(() => {
    return clips.filter(
      (c) => c.type === "text" &&
        currentTime >= c.startTime - 0.01 && currentTime < c.startTime + c.duration,
    )
  }, [clips, currentTime])

  // Active audio clip
  const activeAudioClip = useMemo<LocalClip | null>(() => {
    return clips.find(
      (c) => c.type === "audio" &&
        currentTime >= c.startTime - 0.01 && currentTime < c.startTime + c.duration,
    ) ?? null
  }, [clips, currentTime])

  // Sync video
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!activeClip?.url || activeClip.type !== "video") {
      if (video.src) { video.removeAttribute("src"); video.load() }
      return
    }
    if (video.src !== activeClip.url) { video.src = activeClip.url; video.load() }
    const clipTime = currentTime - activeClip.startTime + (activeClip.trimStart ?? 0)
    if (Math.abs(video.currentTime - clipTime) > 0.15) {
      try { video.currentTime = Math.max(0, clipTime) } catch { /* not ready */ }
    }
    video.volume = muted ? 0 : (activeClip.volume ?? 1)
    video.style.filter = activeClip.metadata?.filter as string ?? ""
  }, [activeClip, currentTime, muted])

  // Sync audio
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!activeAudioClip?.url) {
      if (audio.src) { audio.removeAttribute("src"); audio.load() }
      return
    }
    if (audio.src !== activeAudioClip.url) { audio.src = activeAudioClip.url; audio.load() }
    const clipTime = currentTime - activeAudioClip.startTime + (activeAudioClip.trimStart ?? 0)
    if (Math.abs(audio.currentTime - clipTime) > 0.15) {
      try { audio.currentTime = Math.max(0, clipTime) } catch { /* ignore */ }
    }
    audio.volume = muted ? 0 : (activeAudioClip.volume ?? 1) * volume
  }, [activeAudioClip, currentTime, volume, muted])

  // RAF playback loop
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
      const store = useEditorStore.getState()
      const dur = store.playback.duration
      const next = store.playback.currentTime + dt * store.playback.playbackRate
      if (dur > 0 && next >= dur) {
        store.pause(); store.setCurrentTime(dur)
      } else {
        store.setCurrentTime(next)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    videoRef.current?.play().catch(() => {})
    audioRef.current?.play().catch(() => {})
    return () => cancelAnimationFrame(raf)
  }, [isPlaying])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    if (audioRef.current && !activeAudioClip) audioRef.current.volume = muted ? 0 : volume
  }, [volume, activeAudioClip, muted])

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    seek(Math.max(0, Math.min(1, x / rect.width)) * (duration || 0))
    selectClip(null)
  }

  const stepFrame = (dir: 1 | -1) => {
    seek(Math.max(0, Math.min(duration, currentTime + dir * (1 / 30))))
  }

  const handleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) el.requestFullscreen?.()
    else document.exitFullscreen?.()
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
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain"
          playsInline
        />
        <audio ref={audioRef} className="hidden" />

        {activeClip?.type === "image" && activeClip.url && (
          <img src={activeClip.url} alt="" className="absolute inset-0 h-full w-full object-contain" />
        )}

        {/* Text overlays */}
        {activeTextClips.map((tc) => {
          let td = { text: "Text", fontSize: 32, fontWeight: "bold", color: "#ffffff" }
          try { if (tc.url) td = { ...td, ...JSON.parse(tc.url) } } catch { /* ignore */ }
          return (
            <div key={tc.id} className="pointer-events-none absolute inset-x-0 bottom-16 flex items-end justify-center px-4">
              <span
                className="rounded px-2 py-1 text-center"
                style={{
                  fontSize: `${td.fontSize * 0.6}px`,
                  fontWeight: td.fontWeight,
                  color: td.color,
                  textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                }}
              >
                {td.text}
              </span>
            </div>
          )
        })}

        {/* Empty state */}
        {clips.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-center text-muted-foreground">
            <div>
              <p className="text-[13px] font-medium text-foreground">No clips on the timeline</p>
              <p className="mt-1 text-[11px]">Upload media and add clips to start editing</p>
            </div>
          </div>
        )}

        {/* Center play overlay */}
        <button
          onClick={togglePlay}
          className={`absolute inset-0 grid place-items-center transition-opacity ${showControls ? "opacity-100" : "opacity-0"}`}
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
          className="absolute bottom-3 right-3 grid size-8 place-items-center rounded bg-background/80 text-foreground backdrop-blur hover:bg-background"
          title="Fullscreen"
        >
          <Icon name="fullscreen" className="size-4" />
        </button>

        {/* Controls bar */}
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity ${showControls ? "opacity-100" : "opacity-0"}`}>
          {/* Scrubber with remote cursors */}
          <div className="group relative mb-3 h-1.5 w-full cursor-pointer rounded-full bg-white/20" onClick={handleSeek}>
            {/* Progress */}
            <div
              className="relative h-full rounded-full bg-primary"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 size-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {/* Remote cursor markers */}
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
            {/* Skip back 5s */}
            <button onClick={() => seek(Math.max(0, currentTime - 5))} className="grid size-7 place-items-center rounded text-white hover:bg-white/10" title="Back 5s">
              <Icon name="skip-back" className="size-3.5" />
            </button>

            {/* Frame back */}
            <button onClick={() => stepFrame(-1)} className="grid size-7 place-items-center rounded text-white hover:bg-white/10" title="Previous frame (,)">
              <Icon name="frame-back" className="size-3.5" />
            </button>

            {/* Play/Pause */}
            <button onClick={togglePlay} className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground hover:scale-110 transition-transform" title={isPlaying ? "Pause" : "Play"}>
              <Icon name={isPlaying ? "pause" : "play"} className="size-4" />
            </button>

            {/* Frame forward */}
            <button onClick={() => stepFrame(1)} className="grid size-7 place-items-center rounded text-white hover:bg-white/10" title="Next frame (.)">
              <Icon name="frame-forward" className="size-3.5" />
            </button>

            {/* Skip forward 5s */}
            <button onClick={() => seek(Math.min(duration, currentTime + 5))} className="grid size-7 place-items-center rounded text-white hover:bg-white/10" title="Forward 5s">
              <Icon name="skip-forward" className="size-3.5" />
            </button>

            {/* Volume + mute */}
            <div className="ml-1 flex items-center gap-1.5">
              <button onClick={() => setMuted((m) => !m)} className="grid size-6 place-items-center rounded text-white hover:bg-white/10" title={muted ? "Unmute (M)" : "Mute (M)"}>
                <Icon name={muted ? "mute" : "volume"} className="size-3.5" />
              </button>
              <input
                type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume}
                onChange={(e) => { setMuted(false); setVolume(parseFloat(e.target.value)) }}
                className="h-1 w-16 cursor-pointer accent-primary"
              />
            </div>

            {/* Playback rate */}
            <div className="relative ml-auto">
              <button
                onClick={() => setShowRates((v) => !v)}
                className="rounded px-2 py-0.5 text-[11px] font-medium text-white hover:bg-white/10"
                title="Playback speed"
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
  )
}
