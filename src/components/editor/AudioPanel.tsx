import { useRef, useState, useCallback, useEffect } from "react"
import WaveSurfer from "wavesurfer.js"
import {
  Upload, Play, Pause, Plus, Volume2, VolumeX,
  Trash2, Music, Sliders, AlertCircle, Search, ListMusic,
} from "lucide-react"
import { useEditorStore, type LocalClip, type LocalMedia } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import { api, uploadToCloudinary } from "@/lib/api"
import { MUSIC_CATALOG, MOODS, GENRES, type CatalogTrack, type Mood, type Genre } from "@/lib/musicCatalog"
import { useAudioMixerAPI } from "@/context/AudioMixerContext"

// ─── VU Meter ─────────────────────────────────────────────────────────────────
// Renders a vertical bar that animates via RAF, reading levels from getLevels().
// `trackId` is the clip id, or "master" for the master bus.

const DB_FLOOR = -60  // dBFS floor shown as empty bar
const DB_CLIP  =  -3  // above this → red segment

function dbToFraction(db: number): number {
  if (!isFinite(db)) return 0
  return Math.max(0, Math.min(1, (db - DB_FLOOR) / -DB_FLOOR))
}

function VUMeter({ trackId, getLevels }: { trackId: string; getLevels: () => Map<string, number> }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const peakRef    = useRef(0)          // peak hold fraction
  const peakTsRef  = useRef(0)          // timestamp of last peak update
  const rafRef     = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw)

      const levels = getLevels()
      const db     = levels.get(trackId) ?? -Infinity
      const frac   = dbToFraction(db)

      // Peak hold: update if new peak, decay after 1.5 s
      if (frac > peakRef.current) {
        peakRef.current = frac
        peakTsRef.current = now
      } else if (now - peakTsRef.current > 1500) {
        peakRef.current = Math.max(0, peakRef.current - 0.008)
      }

      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = "rgba(0,0,0,0.35)"
      ctx.fillRect(0, 0, W, H)

      // Filled bar (bottom-up)
      const barH = Math.round(frac * H)
      const clipH = Math.round(dbToFraction(DB_CLIP) * H)

      // Green segment
      const greenH = Math.min(barH, H - clipH)
      if (greenH > 0) {
        ctx.fillStyle = "#34d399"
        ctx.fillRect(0, H - greenH, W, greenH)
      }
      // Red (clip) segment
      if (barH > H - clipH) {
        ctx.fillStyle = "#f87171"
        ctx.fillRect(0, H - barH, W, barH - (H - clipH))
      }

      // Peak hold tick
      if (peakRef.current > 0) {
        const py = Math.round((1 - peakRef.current) * H)
        ctx.fillStyle = peakRef.current >= dbToFraction(DB_CLIP) ? "#fbbf24" : "#a7f3d0"
        ctx.fillRect(0, py, W, 2)
      }
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [trackId, getLevels])

  return (
    <canvas
      ref={canvasRef}
      width={6}
      height={48}
      className="shrink-0 rounded-sm"
      style={{ imageRendering: "pixelated" }}
    />
  )
}

function localId() {
  return `tmp_${crypto.randomUUID()}`
}

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement("audio")
    el.preload = "metadata"
    el.src = url
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(isFinite(el.duration) && el.duration > 0 ? el.duration : 5) }
    el.onerror = () => { URL.revokeObjectURL(url); resolve(5) }
  })
}

function fmt(s?: number) {
  if (!s || !isFinite(s)) return "--:--"
  const m = Math.floor(s / 60)
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`
}

// ─── Waveform with interactive seek and playhead ──────────────────────────────
function Waveform({
  url,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  height = 40,
  color = "rgba(52,211,153,0.8)",
}: {
  url?: string
  currentTime?: number
  duration?: number
  isPlaying?: boolean
  onSeek?: (t: number) => void
  height?: number
  color?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)

  useEffect(() => {
    if (!containerRef.current || !url) return
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: color,
      progressColor: color.replace("0.8", "0.3"),
      height,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      interact: !!onSeek,
      normalize: true,
      backend: "WebAudio",
    })
    wsRef.current = ws
    ws.load(url).catch(() => {})
    if (onSeek) {
      ws.on("interaction", (progress) => {
        const dur = ws.getDuration()
        if (dur > 0 && progress !== undefined) onSeek(progress * dur)
      })
    }
    return () => { ws.destroy(); wsRef.current = null }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync playhead position without re-creating the instance
  useEffect(() => {
    const ws = wsRef.current
    if (!ws || currentTime === undefined || !duration || duration === 0) return
    try {
      ws.seekTo(Math.min(1, Math.max(0, currentTime / duration)))
    } catch { /* ignore */ }
  }, [currentTime, duration])

  // Keep WaveSurfer play state in sync (muted — audio is driven by PreviewPanel)
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    if (isPlaying) ws.play().catch(() => {})
    else ws.pause()
  }, [isPlaying])

  return <div ref={containerRef} style={{ pointerEvents: onSeek ? "auto" : "none" }} />
}

// ─── Library tab ─────────────────────────────────────────────────────────────
function LibraryTab() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const { accessToken } = useAuth()

  const mediaAssets = useEditorStore((s) => s.mediaAssets)
  const addMediaAssetLocal = useEditorStore((s) => s.addMediaAssetLocal)
  const updateMediaAssetLocal = useEditorStore((s) => s.updateMediaAssetLocal)
  const removeMediaAssetLocal = useEditorStore((s) => s.removeMediaAssetLocal)
  const addClipLocal = useEditorStore((s) => s.addClipLocal)
  const syncAddClip = useEditorStore((s) => s.syncAddClip)
  const clips = useEditorStore((s) => s.clips)
  const projectId = useEditorStore((s) => s.projectId)
  const selectClip = useEditorStore((s) => s.selectClip)
  const seek = useEditorStore((s) => s.seek)

  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewTime, setPreviewTime] = useState(0)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const audioAssets = mediaAssets.filter((a) => a.type === "audio")

  const uploadAudio = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio")) { setError("Only audio files are supported"); return }
    if (!accessToken || !projectId) { setError("Open a project first"); return }
    setError(null)
    const tempId = localId()
    const previewUrl = URL.createObjectURL(file)
    addMediaAssetLocal({ id: tempId, serverId: "", name: file.name, type: "audio", url: previewUrl, uploading: true, progress: 0 })
    try {
      const duration = await readAudioDuration(file)
      const sig = await api.createCloudinaryUpload(accessToken, { filename: file.name, type: "AUDIO" })
      const uploaded = await uploadToCloudinary(file, sig, (pct) => updateMediaAssetLocal(tempId, { progress: pct }))
      const persisted = await api.createMedia(accessToken, {
        filename: file.name, type: "audio",
        size: uploaded.bytes ?? file.size,
        url: uploaded.secure_url, projectId,
        duration: uploaded.duration ?? duration,
      })
      updateMediaAssetLocal(tempId, {
        id: `srv_${persisted.id}`, serverId: persisted.id,
        url: persisted.url, name: persisted.filename,
        type: "audio", duration: persisted.duration ?? duration,
        uploading: false, progress: 100,
      })
      URL.revokeObjectURL(previewUrl)
    } catch (err) {
      updateMediaAssetLocal(tempId, { uploading: false, progress: 0, error: err instanceof Error ? err.message : "Upload failed" })
    }
  }, [accessToken, projectId, addMediaAssetLocal, updateMediaAssetLocal])

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const over = (e: DragEvent) => { e.preventDefault(); setDragOver(true) }
    const leave = (e: DragEvent) => { if (e.target === el) setDragOver(false) }
    const drop = (e: DragEvent) => { e.preventDefault(); setDragOver(false); Array.from(e.dataTransfer?.files ?? []).forEach(uploadAudio) }
    el.addEventListener("dragover", over)
    el.addEventListener("dragleave", leave)
    el.addEventListener("drop", drop)
    return () => { el.removeEventListener("dragover", over); el.removeEventListener("dragleave", leave); el.removeEventListener("drop", drop) }
  }, [uploadAudio])

  const handleAddToTimeline = async (asset: LocalMedia) => {
    if (asset.uploading || asset.error || !asset.serverId || !accessToken) return
    const lastEnd = clips.filter((c) => c.type === "audio").reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
    const duration = asset.duration && asset.duration > 0 ? asset.duration : 5
    const clip: LocalClip = {
      id: localId(), mediaId: asset.serverId, type: "audio",
      url: asset.url, startTime: lastEnd, duration,
      track: 3, trimStart: 0, trimEnd: duration, volume: 1, effects: [],
    }
    addClipLocal(clip)
    await syncAddClip(clip, accessToken)
    const latest = useEditorStore.getState().clips.find((c) => c.id === clip.id)
    if (latest) { selectClip(latest.id); seek(latest.startTime) }
  }

  const togglePreview = (asset: LocalMedia) => {
    if (!asset.url) return
    if (previewId === asset.id) {
      previewAudioRef.current?.pause()
      setPreviewId(null)
      return
    }
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current.src = "" }
    const el = new Audio(asset.url)
    el.volume = 0.8
    el.ontimeupdate = () => setPreviewTime(el.currentTime)
    el.onended = () => { setPreviewId(null); setPreviewTime(0) }
    el.play().catch(() => {})
    previewAudioRef.current = el
    setPreviewId(asset.id)
    setPreviewTime(0)
  }

  useEffect(() => () => { previewAudioRef.current?.pause() }, [])

  return (
    <div
      ref={dropRef}
      className={`relative flex h-full flex-col transition-colors ${dragOver ? "ring-2 ring-emerald-400 ring-inset" : ""}`}
    >
      <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden"
        onChange={(e) => { Array.from(e.target.files ?? []).forEach(uploadAudio); if (fileInputRef.current) fileInputRef.current.value = "" }}
      />

      {error && (
        <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] text-red-400">
          <AlertCircle className="size-3 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="underline">dismiss</button>
        </div>
      )}

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-emerald-500/10 backdrop-blur-sm">
          <div className="rounded-lg border-2 border-dashed border-emerald-400 bg-background/80 px-5 py-4 text-[12px] font-medium text-foreground">
            Drop audio files here
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {audioAssets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-emerald-500/10">
              <Music className="size-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-[12px] font-medium text-foreground">No audio files</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Upload MP3, WAV, AAC or drop here</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!projectId || !accessToken}
              className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              <Upload className="size-3" /> Upload audio
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 p-2">
            {audioAssets.map((asset) => {
              const isPreviewing = previewId === asset.id
              return (
                <div
                  key={asset.id}
                  className={`group rounded-lg border bg-card transition-all ${
                    asset.error ? "border-red-500/40" : isPreviewing ? "border-emerald-500/60 bg-emerald-500/5" : "border-border/60 hover:border-emerald-500/40"
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 px-2.5 pt-2.5 pb-1">
                    <button
                      onClick={() => togglePreview(asset)}
                      disabled={asset.uploading || !!asset.error}
                      className={`grid size-7 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40 ${
                        isPreviewing ? "bg-emerald-500 text-white" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                    >
                      {isPreviewing ? <Pause className="size-3" /> : <Play className="size-3" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-foreground">{asset.name}</p>
                      <p className="text-[9px] text-muted-foreground">{fmt(asset.duration)}</p>
                    </div>
                    <button
                      onClick={() => handleAddToTimeline(asset)}
                      disabled={asset.uploading || !!asset.error}
                      title="Add to timeline"
                      className="grid size-6 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-400 opacity-0 transition-opacity hover:bg-emerald-500/20 group-hover:opacity-100 disabled:opacity-0"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      onClick={() => removeMediaAssetLocal(asset.id)}
                      title="Remove"
                      className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground/40 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>

                  {/* Waveform / progress */}
                  <div className="px-2.5 pb-2">
                    {asset.uploading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${asset.progress ?? 0}%` }} />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{asset.progress ?? 0}%</span>
                      </div>
                    ) : (
                      <>
                        <Waveform
                          url={asset.url}
                          currentTime={isPreviewing ? previewTime : undefined}
                          duration={asset.duration}
                          height={32}
                          color="rgba(52,211,153,0.75)"
                        />
                        {isPreviewing && (
                          <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
                            <span>{fmt(previewTime)}</span>
                            <span>{fmt(asset.duration)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {asset.error && (
                    <p className="px-2.5 pb-2 text-[9px] text-red-400">{asset.error}</p>
                  )}
                </div>
              )
            })}

            {/* Upload more */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!projectId || !accessToken}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-2.5 text-[10px] text-muted-foreground transition-colors hover:border-emerald-500/40 hover:text-emerald-400 disabled:opacity-40"
            >
              <Upload className="size-3" /> Upload more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Mixer tab ────────────────────────────────────────────────────────────────
function MixerTab() {
  const clips = useEditorStore((s) => s.clips)
  const updateClipLocal = useEditorStore((s) => s.updateClipLocal)
  const syncUpdateClip = useEditorStore((s) => s.syncUpdateClip)
  const syncDeleteClip = useEditorStore((s) => s.syncDeleteClip)
  const selectClip = useEditorStore((s) => s.selectClip)
  const seek = useEditorStore((s) => s.seek)
  const selectedClipId = useEditorStore((s) => s.selectedClipId)
  const currentTime = useEditorStore((s) => s.playback.currentTime)
  const isPlaying = useEditorStore((s) => s.playback.isPlaying)
  const { accessToken } = useAuth()
  const mixerAPI = useAudioMixerAPI()
  const getLevels = mixerAPI?.getLevels ?? (() => new Map<string, number>())

  const [soloId, setSoloId] = useState<string | null>(null)

  const audioClips = clips.filter((c) => c.type === "audio" || c.type === "video")

  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleVolume = (clip: LocalClip, vol: number) => {
    updateClipLocal(clip.id, { volume: vol })
    clearTimeout(debounceRefs.current[clip.id])
    debounceRefs.current[clip.id] = setTimeout(() => {
      if (accessToken) syncUpdateClip(clip.id, { volume: vol }, accessToken)
    }, 400)
  }

  const handlePan = (clip: LocalClip, pan: number) => {
    updateClipLocal(clip.id, { pan })
    clearTimeout(debounceRefs.current[`pan_${clip.id}`])
    debounceRefs.current[`pan_${clip.id}`] = setTimeout(() => {
      if (accessToken) syncUpdateClip(clip.id, { pan }, accessToken)
    }, 400)
  }

  const handleMute = (clip: LocalClip) => {
    const next = clip.volume === 0 ? 1 : 0
    handleVolume(clip, next)
  }

  const handleSolo = (id: string) => {
    const next = soloId === id ? null : id
    setSoloId(next)
    mixerAPI?.setSolo(next)
  }

  const handleDelete = async (clip: LocalClip) => {
    if (accessToken) await syncDeleteClip(clip.id, accessToken)
  }

  if (audioClips.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <Sliders className="size-8 text-muted-foreground/30" />
        <p className="text-[12px] font-medium text-foreground">No audio clips</p>
        <p className="text-[10px] text-muted-foreground">Add audio or video clips to the timeline to mix them here</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 divide-y divide-border/40 overflow-y-auto">
      {audioClips.map((clip) => {
        const isSelected = selectedClipId === clip.id
        const isMuted = clip.volume === 0
        const isSolo = soloId === clip.id
        const isActive = currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration
        const vol = clip.volume ?? 1
        const volPct = Math.round(vol * 100)

        return (
          <div
            key={clip.id}
            className={`flex flex-col gap-2 px-3 py-3 transition-colors ${
              isSelected ? "bg-primary/5" : isActive ? "bg-emerald-500/5" : "hover:bg-muted/30"
            }`}
          >
            {/* Clip header */}
            <div className="flex items-center gap-2">
              <VUMeter trackId={clip.id} getLevels={getLevels} />
              <div
                className={`size-2 shrink-0 rounded-full ${isActive ? "animate-pulse bg-emerald-400" : "bg-muted-foreground/30"}`}
              />
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => { selectClip(clip.id); seek(clip.startTime) }}
              >
                <p className="truncate text-[11px] font-medium text-foreground">
                  {clip.type === "video" ? "🎬" : "🎵"} {clip.url?.split("/").pop()?.split("?")[0] ?? `Clip ${clip.id.slice(-4)}`}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  Track {clip.track + 1} · {fmt(clip.startTime)} → {fmt(clip.startTime + clip.duration)}
                </p>
              </button>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-medium ${
                isMuted ? "bg-red-500/10 text-red-400" : "bg-muted text-muted-foreground"
              }`}>
                {isMuted ? "MUTE" : `${volPct}%`}
              </span>
            </div>

            {/* Waveform strip */}
            {clip.url && (
              <div className="overflow-hidden rounded-md bg-black/20">
                <Waveform
                  url={clip.url}
                  currentTime={isActive ? currentTime - clip.startTime : undefined}
                  duration={clip.duration}
                  isPlaying={isActive && isPlaying}
                  onSeek={(t) => seek(clip.startTime + t)}
                  height={28}
                  color={clip.type === "video" ? "rgba(139,92,246,0.7)" : "rgba(52,211,153,0.7)"}
                />
              </div>
            )}

            {/* Volume + solo + delete */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMute(clip)}
                title={isMuted ? "Unmute" : "Mute"}
                className={`grid size-6 shrink-0 place-items-center rounded transition-colors ${
                  isMuted ? "bg-red-500/20 text-red-400" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
              </button>

              <input
                type="range" min={0} max={1} step={0.01}
                value={isMuted ? 0 : vol}
                onChange={(e) => handleVolume(clip, parseFloat(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-emerald-400"
              />

              <button
                onClick={() => handleSolo(clip.id)}
                title="Solo"
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors ${
                  isSolo ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
                }`}
              >
                S
              </button>

              <button
                onClick={() => handleDelete(clip)}
                title="Remove clip"
                className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="size-3" />
              </button>
            </div>

            {/* Pan slider */}
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-[9px] text-muted-foreground/60">L</span>
              <input
                type="range" min={-1} max={1} step={0.01}
                value={clip.pan ?? 0}
                onChange={(e) => handlePan(clip, parseFloat(e.target.value))}
                className="h-1 flex-1 cursor-pointer accent-sky-400"
                title={`Pan: ${Math.round((clip.pan ?? 0) * 100)}`}
              />
              <span className="w-6 shrink-0 text-center text-[9px] text-muted-foreground/60">R</span>
              {(clip.pan ?? 0) !== 0 && (
                <button
                  onClick={() => handlePan(clip, 0)}
                  className="text-[8px] text-muted-foreground/50 hover:text-foreground"
                  title="Center pan"
                >
                  C
                </button>
              )}
            </div>

            {/* Trim indicators */}
            <div className="flex items-center justify-between text-[9px] text-muted-foreground/50">
              <span>In: {fmt(clip.trimStart ?? 0)}</span>
              <span className="text-[8px]">dur {fmt(clip.duration)}</span>
              <span>Out: {fmt(clip.trimEnd ?? clip.duration)}</span>
            </div>
          </div>
        )
      })}

      {/* Master bus strip */}
      <div className="flex items-center gap-2 border-t border-border/60 bg-muted/20 px-3 py-2.5">
        <VUMeter trackId="master" getLevels={getLevels} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Master</span>
      </div>
    </div>
  )
}

// ─── Music tab ────────────────────────────────────────────────────────────────
function MusicTab() {
  const addClipLocal = useEditorStore((s) => s.addClipLocal)
  const clips = useEditorStore((s) => s.clips)
  const selectClip = useEditorStore((s) => s.selectClip)
  const seek = useEditorStore((s) => s.seek)

  const [query, setQuery] = useState("")
  const [mood, setMood] = useState<Mood | "">( "")
  const [genre, setGenre] = useState<Genre | "">( "")
  const [previewId, setPreviewId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const filtered = MUSIC_CATALOG.filter((t) => {
    if (mood && t.mood !== mood) return false
    if (genre && t.genre !== genre) return false
    if (query) {
      const q = query.toLowerCase()
      return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    }
    return true
  })

  const togglePreview = (track: CatalogTrack) => {
    if (previewId === track.id) {
      audioRef.current?.pause()
      setPreviewId(null)
      return
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = "" }
    const el = new Audio(track.url)
    el.volume = 0.6
    el.play().catch(() => {})
    el.onended = () => setPreviewId(null)
    audioRef.current = el
    setPreviewId(track.id)
  }

  useEffect(() => () => { audioRef.current?.pause() }, [])

  const addToTimeline = (track: CatalogTrack) => {
    const lastEnd = clips.filter((c) => c.type === "audio").reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
    const clip: LocalClip = {
      id: localId(), mediaId: "", serverId: "", type: "audio",
      url: track.url, startTime: lastEnd, duration: track.duration,
      track: 3, trimStart: 0, trimEnd: track.duration, volume: 1, effects: [],
    }
    addClipLocal(clip)
    selectClip(clip.id)
    seek(clip.startTime)
    if (previewId === track.id) { audioRef.current?.pause(); setPreviewId(null) }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="shrink-0 border-b border-border/60 p-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks…"
            className="w-full rounded-md border border-border bg-background py-1.5 pl-6 pr-2 text-[11px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>
        {/* Mood chips */}
        <div className="flex flex-wrap gap-1">
          {MOODS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMood((prev) => prev === m.value ? "" : m.value)}
              className={`rounded-full border px-2 py-0.5 text-[9px] font-medium transition-colors ${
                mood === m.value ? m.color : "border-border/50 text-muted-foreground hover:border-border"
              }`}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
        {/* Genre select */}
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value as Genre | "")}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        >
          <option value="">All genres</option>
          {GENRES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>

      {/* Track list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <ListMusic className="size-8 text-muted-foreground/30" />
            <p className="text-[11px] text-muted-foreground">No tracks match your filters</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/40">
            {filtered.map((track) => {
              const isPreviewing = previewId === track.id
              return (
                <div key={track.id} className={`group flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted/30 ${
                  isPreviewing ? "bg-emerald-500/5" : ""
                }`}>
                  {/* Color/Image avatar */}
                  <div
                    className="grid size-8 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white overflow-hidden"
                    style={
                      track.thumbnail.startsWith("http") 
                        ? { 
                            backgroundImage: `url(${track.thumbnail})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center"
                          } 
                        : { backgroundColor: track.thumbnail }
                    }
                  >
                    {track.title[0]}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-foreground">{track.title}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {track.genre} · {fmt(track.duration)}{track.bpm ? ` · ${track.bpm} BPM` : ""}
                    </p>
                  </div>

                  {/* Preview */}
                  <button
                    onClick={() => togglePreview(track)}
                    className={`grid size-6 shrink-0 place-items-center rounded-full transition-colors ${
                      isPreviewing
                        ? "bg-emerald-500 text-white"
                        : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                  >
                    {isPreviewing ? <Pause className="size-3" /> : <Play className="size-3" />}
                  </button>

                  {/* Add */}
                  <button
                    onClick={() => addToTimeline(track)}
                    title="Add to timeline"
                    className="grid size-6 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-400 opacity-0 transition-opacity hover:bg-emerald-500/20 group-hover:opacity-100"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────
type Tab = "library" | "mixer" | "music"

export function AudioPanel() {
  const [tab, setTab] = useState<Tab>("library")
  const audioClipCount = useEditorStore((s) => s.clips.filter((c) => c.type === "audio" || c.type === "video").length)
  const audioAssetCount = useEditorStore((s) => s.mediaAssets.filter((a) => a.type === "audio").length)
  const projectId = useEditorStore((s) => s.projectId)
  const { accessToken } = useAuth()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Audio</span>
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
          <button
            onClick={() => setTab("library")}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              tab === "library" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Music className="size-3" /> Library
            {audioAssetCount > 0 && (
              <span className="rounded-full bg-emerald-500/20 px-1 text-[8px] text-emerald-400">{audioAssetCount}</span>
            )}
          </button>
          <button
            onClick={() => setTab("music")}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              tab === "music" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListMusic className="size-3" /> Music
          </button>
          <button
            onClick={() => setTab("mixer")}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              tab === "mixer" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sliders className="size-3" /> Mixer
            {audioClipCount > 0 && (
              <span className="rounded-full bg-primary/20 px-1 text-[8px] text-primary">{audioClipCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* No project guard */}
      {(!projectId || !accessToken) && tab === "library" && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-300">
          Open a project to upload audio
        </div>
      )}

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "library" ? <LibraryTab /> : tab === "music" ? <MusicTab /> : <MixerTab />}
      </div>
    </div>
  )
}