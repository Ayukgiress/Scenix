import { useRef, useEffect, useState, useMemo, useCallback } from "react"
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Maximize2, Volume2, VolumeX
} from "lucide-react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import { useRealtimeCursors } from "@/hooks/useRealtimeCursors"
import { interpolateKeyframes } from "@/components/editor/KeyframePanel"
import { colorGradeToFilter } from "@/components/editor/ColorGradePanel"

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

function findActiveClip(clips: LocalClip[], t: number): LocalClip | null {
  return (
    clips.find(
      (c) =>
        c.type !== "audio" &&
        c.type !== "text" &&
        c.type !== "sticker" &&
        t >= c.startTime - 0.05 &&
        t < c.startTime + c.duration + 0.05,
    ) ?? null
  )
}

function findActiveAudio(clips: LocalClip[], t: number): LocalClip | null {
  return (
    clips.find(
      (c) =>
        c.type === "audio" &&
        t >= c.startTime - 0.05 &&
        t < c.startTime + c.duration + 0.05,
    ) ?? null
  )
}

export function PreviewPanel() {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const audioRef     = useRef<HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track what URL is currently loaded so we only reload when it changes
  const loadedVideoUrl = useRef<string>("")
  const loadedAudioUrl = useRef<string>("")

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
  const [videoError, setVideoError] = useState<string | null>(null)

  const remoteCursors = useRealtimeCursors()

  // ── Active clips derived from store time ──────────────────────────────────
  const activeClip = useMemo(
    () => findActiveClip(clips, currentTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clips, Math.floor(currentTime * 4)],
  )
  const activeAudioClip = useMemo(
    () => findActiveAudio(clips, currentTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clips, Math.floor(currentTime * 4)],
  )
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

  const finalFilter = useMemo(() => {
    const clipFilter = (activeClip?.metadata?.filter as string) ?? ""
    const gradeFilter = activeClip?.colorGrade ? colorGradeToFilter(activeClip.colorGrade) : ""
    return [clipFilter, gradeFilter].filter(Boolean).join(" ")
  }, [activeClip])

  // Chroma key style
  const chromaKeyStyle = useMemo(() => {
    const ck = activeClip?.chromaKey
    if (!ck?.enabled) return {}
    return { mixBlendMode: "multiply" as const }
  }, [activeClip])

  // Keyframe-animated opacity for active clip
  const animatedOpacity = useMemo(() => {
    if (!activeClip?.keyframes?.length) return activeClip?.opacity ?? 1
    const relTime = currentTime - activeClip.startTime
    return interpolateKeyframes(activeClip.keyframes, "opacity", relTime, activeClip.opacity ?? 1)
  }, [activeClip, currentTime])

  // ── Load video whenever the active clip's URL changes ─────────────────────
  const videoUrl = activeClip?.type === "video" ? (activeClip.url ?? "") : ""
  const clipSpeed = activeClip?.speed ?? 1

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (videoUrl === loadedVideoUrl.current) return
    loadedVideoUrl.current = videoUrl
    setVideoError(null)

    if (!videoUrl) {
      video.pause()
      video.removeAttribute("src")
      video.load()
      return
    }

    const store = useEditorStore.getState()
    const vc = findActiveClip(store.clips, store.playback.currentTime)
    const clipTime = vc
      ? store.playback.currentTime - vc.startTime + (vc.trimStart ?? 0)
      : 0

    video.pause()
    video.src = videoUrl
    video.volume = muted ? 0 : (vc?.volume ?? 1)
    video.playbackRate = store.playback.playbackRate * clipSpeed

    const onCanPlay = () => {
      try { video.currentTime = Math.max(0, clipTime) } catch { /* ignore */ }
      if (useEditorStore.getState().playback.isPlaying) {
        video.play().catch((e) => {
          if (e.name !== "AbortError") console.warn("video play:", e)
        })
      }
    }

    const onError = () => {
      const err = video.error
      setVideoError(
        err ? `Video error ${err.code}: ${err.message}` : "Failed to load video",
      )
    }

    video.addEventListener("canplay", onCanPlay, { once: true })
    video.addEventListener("error", onError, { once: true })

    return () => {
      video.removeEventListener("canplay", onCanPlay)
      video.removeEventListener("error", onError)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl])

  // ── Load audio whenever the active audio clip changes ─────────────────────
  const audioUrl = activeAudioClip?.url ?? ""

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (audioUrl === loadedAudioUrl.current) return
    loadedAudioUrl.current = audioUrl

    if (!audioUrl) {
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
      return
    }

    const store = useEditorStore.getState()
    const ac = findActiveAudio(store.clips, store.playback.currentTime)
    const clipTime = ac
      ? store.playback.currentTime - ac.startTime + (ac.trimStart ?? 0)
      : 0

    audio.pause()
    audio.src = audioUrl
    audio.volume = muted ? 0 : (ac?.volume ?? 1) * store.playback.volume
    audio.playbackRate = store.playback.playbackRate

    const onCanPlay = () => {
      try { audio.currentTime = Math.max(0, clipTime) } catch { /* ignore */ }
      if (useEditorStore.getState().playback.isPlaying) {
        audio.play().catch((e) => {
          if (e.name !== "AbortError") console.warn("audio play:", e)
        })
      }
    }

    audio.addEventListener("canplay", onCanPlay, { once: true })
    return () => audio.removeEventListener("canplay", onCanPlay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl])

  // ── Play / pause sync ─────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current

    if (!isPlaying) {
      video?.pause()
      audio?.pause()
      return
    }

    // Start RAF loop to advance store time
    let raf = 0
    let alive = true
    let lastTs: number | null = null

    const step = (now: number) => {
      if (!alive) return
      const store = useEditorStore.getState()
      const vid = videoRef.current

      let next: number
      if (vid && vid.src && !vid.paused && vid.readyState >= 2) {
        // Derive store time from the actual video element position
        const vc = findActiveClip(store.clips, store.playback.currentTime)
        next = vc
          ? vid.currentTime - (vc.trimStart ?? 0) + vc.startTime
          : store.playback.currentTime + (lastTs !== null ? (now - lastTs) / 1000 : 0) * store.playback.playbackRate
      } else {
        const dt = lastTs !== null ? (now - lastTs) / 1000 : 0
        next = store.playback.currentTime + dt * store.playback.playbackRate
      }
      lastTs = now

      if (store.playback.duration > 0 && next >= store.playback.duration) {
        store.pause()
        store.setCurrentTime(store.playback.duration)
        return
      }

      store.setCurrentTime(next)
      raf = requestAnimationFrame(step)
    }

    // Kick off media elements
    if (video?.src) {
      video.play().catch((e) => {
        if (e.name !== "AbortError") console.warn("video play:", e)
      })
    }
    if (audio?.src) {
      audio.play().catch((e) => {
        if (e.name !== "AbortError") console.warn("audio play:", e)
      })
    }

    raf = requestAnimationFrame(step)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      videoRef.current?.pause()
      audioRef.current?.pause()
    }
  }, [isPlaying])

  // ── Seek: when not playing, sync video position to store time ─────────────
  const isPlayingRef = useRef(isPlaying)
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  useEffect(() => {
    if (isPlayingRef.current) return
    const video = videoRef.current
    const audio = audioRef.current
    if (!video || !video.src) return

    const store = useEditorStore.getState()
    const vc = findActiveClip(store.clips, currentTime)
    if (vc) {
      const clipTime = currentTime - vc.startTime + (vc.trimStart ?? 0)
      try { video.currentTime = Math.max(0, clipTime) } catch { /* ignore */ }
    }
    if (audio?.src) {
      const ac = findActiveAudio(store.clips, currentTime)
      if (ac) {
        const clipTime = currentTime - ac.startTime + (ac.trimStart ?? 0)
        try { audio.currentTime = Math.max(0, clipTime) } catch { /* ignore */ }
      }
    }
  }, [currentTime])

  // ── Playback rate (also accounts for clip speed) ─────────────────────────
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate * clipSpeed
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate, clipSpeed])

  // ── Volume / mute ─────────────────────────────────────────────────────────
  useEffect(() => {
    const store = useEditorStore.getState()
    const vc = findActiveClip(store.clips, store.playback.currentTime)
    const ac = findActiveAudio(store.clips, store.playback.currentTime)
    if (videoRef.current) videoRef.current.volume = muted ? 0 : (vc?.volume ?? 1)
    if (audioRef.current) audioRef.current.volume = muted ? 0 : (ac?.volume ?? 1) * volume
  }, [muted, volume])

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

  const showControls = hovering || !isPlaying || clips.length === 0

  return (
    <section
      className="relative h-full w-full bg-[#0a0a0c] overflow-hidden"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
      >
        {/* Main video element — no crossOrigin so Cloudinary range requests work */}
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          preload="auto"
          style={{ filter: finalFilter, opacity: animatedOpacity, ...chromaKeyStyle }}
        />
        <audio ref={audioRef} className="hidden" preload="auto" />

        {/* Image clip */}
        {activeClip?.type === "image" && activeClip.url && (
          <img
            src={activeClip.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

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
              style={{
                left: `${td.x}%`,
                top: `${td.y}%`,
                transform: "translate(-50%, -50%)",
                ...animStyle,
              }}
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
  )
}