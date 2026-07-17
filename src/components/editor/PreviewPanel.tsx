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

function findActiveClip(clips: LocalClip[], t: number): LocalClip | null {
  return clips.find(
    (c) => c.type !== "audio" && c.type !== "text" && c.type !== "sticker" &&
      t >= c.startTime - 0.05 && t < c.startTime + c.duration + 0.05
  ) ?? null
}

function findActiveAudio(clips: LocalClip[], t: number): LocalClip | null {
  return clips.find(
    (c) => c.type === "audio" &&
      t >= c.startTime - 0.05 && t < c.startTime + c.duration + 0.05
  ) ?? null
}

export function PreviewPanel() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Refs for imperative media management — never trigger re-renders
  const loadedVideoUrl = useRef<string | null>(null)
  const loadedAudioUrl = useRef<string | null>(null)
  const activeClipIdRef = useRef<string | null>(null)
  const activeAudioIdRef = useRef<string | null>(null)
  const mutedRef = useRef(false)

  const isPlaying = useEditorStore((s) => s.playback.isPlaying)
  const currentTime = useEditorStore((s) => s.playback.currentTime)
  const duration = useEditorStore((s) => s.playback.duration)
  const volume = useEditorStore((s) => s.playback.volume)
  const playbackRate = useEditorStore((s) => s.playback.playbackRate)
  const clips = useEditorStore((s) => s.clips)
  const effects = useEditorStore((s) => s.effects)
  const togglePlay = useEditorStore((s) => s.togglePlay)
  const seek = useEditorStore((s) => s.seek)
  const setVolume = useEditorStore((s) => s.setVolume)
  const setPlaybackRate = useEditorStore((s) => s.setPlaybackRate)
  const selectClip = useEditorStore((s) => s.selectClip)

  const [hovering, setHovering] = useState(false)
  const [muted, setMuted] = useState(false)
  const [showRates, setShowRates] = useState(false)

  const remoteCursors = useRealtimeCursors()

  // Keep mutedRef in sync so the RAF loop can read it without a closure
  useEffect(() => { mutedRef.current = muted }, [muted])

  // ── Imperative media sync helper ─────────────────────────────────────────
  const syncMedia = (t: number, forceSeek = false) => {
    const video = videoRef.current
    const audio = audioRef.current
    const storeClips = useEditorStore.getState().clips
    const storeVolume = useEditorStore.getState().playback.volume
    const isMuted = mutedRef.current

    // ── Video ──
    const vc = findActiveClip(storeClips, t)
    const videoUrl = vc?.type === "video" ? (vc.url ?? null) : null

    if (video) {
      if (videoUrl !== loadedVideoUrl.current) {
        loadedVideoUrl.current = videoUrl
        activeClipIdRef.current = vc?.id ?? null
        if (!videoUrl) {
          video.removeAttribute("src")
          video.load()
        } else {
          // Capture t at load time so the canplaythrough closure uses the right offset
          const loadedAtT = t
          const loadedVc = vc!
          video.src = videoUrl
          video.preload = "auto"
          video.addEventListener("canplaythrough", () => {
            const clipTime = loadedAtT - loadedVc.startTime + (loadedVc.trimStart ?? 0)
            try { video.currentTime = Math.max(0, clipTime) } catch { /* ignore */ }
            video.volume = isMuted ? 0 : (loadedVc.volume ?? 1)
            video.playbackRate = useEditorStore.getState().playback.playbackRate
            if (useEditorStore.getState().playback.isPlaying) {
              video.play().catch((e) => { if (e.name !== "AbortError") console.warn(e) })
            }
          }, { once: true })
          video.load()
        }
      } else if (vc) {
        const clipTime = t - vc.startTime + (vc.trimStart ?? 0)
        // Only correct drift > 0.5 s during playback; always seek on forceSeek (scrub/pause)
        if (forceSeek || Math.abs(video.currentTime - clipTime) > 0.5) {
          try { video.currentTime = Math.max(0, clipTime) } catch { /* ignore */ }
        }
        video.volume = isMuted ? 0 : (vc.volume ?? 1)
      }
    }

    // ── Audio ──
    const ac = findActiveAudio(storeClips, t)
    const audioUrl = ac?.url ?? null

    if (audio) {
      if (audioUrl !== loadedAudioUrl.current) {
        loadedAudioUrl.current = audioUrl
        activeAudioIdRef.current = ac?.id ?? null
        if (!audioUrl) {
          audio.removeAttribute("src")
          audio.load()
        } else {
          const loadedAtT = t
          const loadedAc = ac!
          audio.src = audioUrl
          audio.preload = "auto"
          audio.addEventListener("canplaythrough", () => {
            const clipTime = loadedAtT - loadedAc.startTime + (loadedAc.trimStart ?? 0)
            try { audio.currentTime = Math.max(0, clipTime) } catch { /* ignore */ }
            audio.volume = isMuted ? 0 : (loadedAc.volume ?? 1) * storeVolume
            audio.playbackRate = useEditorStore.getState().playback.playbackRate
            if (useEditorStore.getState().playback.isPlaying) {
              audio.play().catch((e) => { if (e.name !== "AbortError") console.warn(e) })
            }
          }, { once: true })
          audio.load()
        }
      } else if (ac) {
        const clipTime = t - ac.startTime + (ac.trimStart ?? 0)
        if (forceSeek || Math.abs(audio.currentTime - clipTime) > 0.5) {
          try { audio.currentTime = Math.max(0, clipTime) } catch { /* ignore */ }
        }
        audio.volume = isMuted ? 0 : (ac.volume ?? 1) * storeVolume
      }
    }
  }

  // ── RAF playback loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current

    if (!isPlaying) {
      video?.pause()
      audio?.pause()
      return
    }

    let raf = 0
    let alive = true
    // Use video.currentTime as the source of truth when available to avoid drift
    let lastRafTime: number | null = null

    const step = (now: number) => {
      if (!alive) return

      const store = useEditorStore.getState()
      const video = videoRef.current

      let next: number
      if (video && loadedVideoUrl.current && !video.paused && video.readyState >= 2) {
        // Derive timeline time from the video element — eliminates RAF drift
        const vc = findActiveClip(store.clips, store.playback.currentTime)
        if (vc) {
          next = video.currentTime - (vc.trimStart ?? 0) + vc.startTime
        } else {
          const dt = lastRafTime !== null ? (now - lastRafTime) / 1000 : 0
          next = store.playback.currentTime + dt * store.playback.playbackRate
        }
      } else {
        const dt = lastRafTime !== null ? (now - lastRafTime) / 1000 : 0
        next = store.playback.currentTime + dt * store.playback.playbackRate
      }
      lastRafTime = now

      if (store.playback.duration > 0 && next >= store.playback.duration) {
        store.pause()
        store.setCurrentTime(store.playback.duration)
        syncMedia(store.playback.duration)
        return
      }

      store.setCurrentTime(next)
      syncMedia(next)
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      video?.pause()
      audio?.pause()
    }
   
  }, [isPlaying])

  // ── Sync on seek / scrub (when paused) ───────────────────────────────────
  // Only fires when currentTime changes while NOT playing (seek, frame step)
  const isPlayingRef = useRef(isPlaying)
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  useEffect(() => {
    if (!isPlayingRef.current) {
      syncMedia(currentTime, true)
    }
   
  }, [currentTime])

  // ── Playback rate ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  // ── Volume / mute ─────────────────────────────────────────────────────────
  useEffect(() => {
    const store = useEditorStore.getState()
    const t = store.playback.currentTime
    const vc = findActiveClip(store.clips, t)
    const ac = findActiveAudio(store.clips, t)
    if (videoRef.current) videoRef.current.volume = muted ? 0 : (vc?.volume ?? 1)
    if (audioRef.current) audioRef.current.volume = muted ? 0 : (ac?.volume ?? 1) * volume
  }, [muted, volume])

  // ── Derived render-only values (stable, don't drive effects) ─────────────
  const activeClip = useMemo(
    () => findActiveClip(clips, currentTime),
    // Only recompute when clips array changes or we cross a clip boundary
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clips, Math.floor(currentTime * 4)]  // 4 = quarter-second granularity
  )

  const activeTextClips = useMemo<LocalClip[]>(
    () => clips.filter(
      (c) => c.type === "text" &&
        currentTime >= c.startTime - 0.05 && currentTime < c.startTime + c.duration + 0.05
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clips, Math.floor(currentTime * 4)]
  )

  const finalFilter = useMemo(() => {
    const clipFilter = activeClip?.metadata?.filter as string ?? ""
    return [...effects, clipFilter].filter(Boolean).join(" ")
  }, [effects, activeClip])

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
      className="flex h-full flex-col items-center justify-center bg-[#0a0a0c] p-3"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-full overflow-hidden rounded-lg border border-white/5 bg-black shadow-2xl"
        style={{ aspectRatio: "16/9", maxHeight: "100%" }}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain"
          playsInline
          style={{ filter: finalFilter }}
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
          {/* Scrubber */}
          <div className="group relative mb-3 h-1.5 w-full cursor-pointer rounded-full bg-white/20" onClick={handleSeek}>
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
              <Icon name="skip-back" className="size-3.5" />
            </button>
            <button onClick={() => stepFrame(-1)} className="grid size-7 place-items-center rounded text-white hover:bg-white/10" title="Previous frame">
              <Icon name="frame-back" className="size-3.5" />
            </button>
            <button onClick={togglePlay} className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground hover:scale-110 transition-transform" title={isPlaying ? "Pause" : "Play"}>
              <Icon name={isPlaying ? "pause" : "play"} className="size-4" />
            </button>
            <button onClick={() => stepFrame(1)} className="grid size-7 place-items-center rounded text-white hover:bg-white/10" title="Next frame">
              <Icon name="frame-forward" className="size-3.5" />
            </button>
            <button onClick={() => seek(Math.min(duration, currentTime + 5))} className="grid size-7 place-items-center rounded text-white hover:bg-white/10" title="Forward 5s">
              <Icon name="skip-forward" className="size-3.5" />
            </button>

            <div className="ml-1 flex items-center gap-1.5">
              <button onClick={() => setMuted((m) => !m)} className="grid size-6 place-items-center rounded text-white hover:bg-white/10" title={muted ? "Unmute" : "Mute"}>
                <Icon name={muted ? "mute" : "volume"} className="size-3.5" />
              </button>
              <input
                type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume}
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
  )
}
