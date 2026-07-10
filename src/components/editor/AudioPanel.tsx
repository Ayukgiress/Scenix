import { useRef, useState, useCallback, useEffect } from "react"
import { useEditorStore, type LocalClip, type LocalMedia } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import { api, uploadToCloudinary } from "@/lib/api"

function localId() {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement("audio")
    el.preload = "metadata"
    el.src = url
    el.onloadedmetadata = () => {
      const d = el.duration
      URL.revokeObjectURL(url)
      resolve(isFinite(d) && d > 0 ? d : 5)
    }
    el.onerror = () => { URL.revokeObjectURL(url); resolve(5) }
  })
}

function formatDuration(s?: number) {
  if (!s || !isFinite(s)) return "--:--"
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

// Fake waveform bars for visual flair
function WaveformBars({ count = 24 }: { count?: number }) {
  const bars = Array.from({ length: count }, (_, i) => {
    const h = 20 + Math.abs(Math.sin(i * 1.3 + i * 0.4)) * 60
    return h
  })
  return (
    <div className="flex h-8 items-end gap-px">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-0.5 rounded-full bg-emerald-400/70"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

export function AudioPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const { accessToken } = useAuth()

  const mediaAssets = useEditorStore((s) => s.mediaAssets)
  const addMediaAssetLocal = useEditorStore((s) => s.addMediaAssetLocal)
  const updateMediaAssetLocal = useEditorStore((s) => s.updateMediaAssetLocal)
  const addClipLocal = useEditorStore((s) => s.addClipLocal)
  const syncAddClip = useEditorStore((s) => s.syncAddClip)
  const clips = useEditorStore((s) => s.clips)
  const projectId = useEditorStore((s) => s.projectId)
  const selectClip = useEditorStore((s) => s.selectClip)
  const seek = useEditorStore((s) => s.seek)

  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const previewRef = useRef<HTMLAudioElement | null>(null)

  const audioAssets = mediaAssets.filter((a) => a.type === "audio")

  const uploadAudio = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio")) {
      setError("Only audio files are supported here")
      return
    }
    if (!accessToken || !projectId) {
      setError("Open a project first")
      return
    }
    setError(null)
    const tempId = localId()
    const previewUrl = URL.createObjectURL(file)
    addMediaAssetLocal({
      id: tempId, serverId: "", name: file.name, type: "audio",
      url: previewUrl, uploading: true, progress: 0,
    })
    try {
      const duration = await readAudioDuration(file)
      const signature = await api.createCloudinaryUpload(accessToken, {
        folder: `scenix/projects/${projectId}`,
        filename: file.name,
        type: "AUDIO",
      })
      const uploaded = await uploadToCloudinary(file, signature, (pct) => {
        updateMediaAssetLocal(tempId, { progress: pct })
      })
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
      updateMediaAssetLocal(tempId, {
        uploading: false, progress: 0,
        error: err instanceof Error ? err.message : "Upload failed",
      })
    }
  }, [accessToken, projectId, addMediaAssetLocal, updateMediaAssetLocal])

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true) }
    const onDragLeave = (e: DragEvent) => { if (e.target === el) setDragOver(false) }
    const onDrop = (e: DragEvent) => {
      e.preventDefault(); setDragOver(false)
      const files = e.dataTransfer?.files
      if (files) Array.from(files).forEach(uploadAudio)
    }
    el.addEventListener("dragover", onDragOver)
    el.addEventListener("dragleave", onDragLeave)
    el.addEventListener("drop", onDrop)
    return () => {
      el.removeEventListener("dragover", onDragOver)
      el.removeEventListener("dragleave", onDragLeave)
      el.removeEventListener("drop", onDrop)
    }
  }, [uploadAudio])

  const handleAddToTimeline = async (asset: LocalMedia) => {
    if (asset.uploading || asset.error || !asset.serverId || !accessToken) return
    // Place audio on track 3 (dedicated audio track)
    const lastEnd = clips
      .filter((c) => c.type === "audio")
      .reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
    const duration = asset.duration && asset.duration > 0 ? asset.duration : 5
    const localClip: LocalClip = {
      id: localId(), mediaId: asset.serverId, type: "audio",
      url: asset.url, startTime: lastEnd, duration,
      track: 3, trimStart: 0, trimEnd: duration, volume: 1,
    }
    addClipLocal(localClip)
    await syncAddClip(localClip, accessToken)
    const latest = useEditorStore.getState().clips.find((c) => c.id === localClip.id)
    if (latest) { selectClip(latest.id); seek(latest.startTime) }
  }

  const togglePreview = (asset: LocalMedia) => {
    if (!asset.url) return
    if (previewId === asset.id) {
      previewRef.current?.pause()
      setPreviewId(null)
      return
    }
    if (previewRef.current) previewRef.current.pause()
    const audio = new Audio(asset.url)
    previewRef.current = audio
    audio.play().catch(() => {})
    audio.onended = () => setPreviewId(null)
    setPreviewId(asset.id)
  }

  useEffect(() => () => { previewRef.current?.pause() }, [])

  return (
    <div
      ref={dropRef}
      className={`relative flex h-full flex-col transition-colors ${dragOver ? "ring-2 ring-emerald-400 ring-inset" : ""}`}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Audio & Music
        </span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!projectId || !accessToken}
          className="rounded p-1 text-foreground/60 hover:bg-muted hover:text-foreground disabled:opacity-40"
          title="Upload audio"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files) Array.from(files).forEach(uploadAudio)
          if (fileInputRef.current) fileInputRef.current.value = ""
        }}
      />

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-emerald-500/10 backdrop-blur-sm">
          <div className="rounded-md border-2 border-dashed border-emerald-400 bg-background/80 px-4 py-3 text-[12px] font-medium text-foreground">
            Drop audio files here
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {audioAssets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-emerald-500/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-emerald-400">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <p className="text-[12px] font-medium text-foreground">No audio yet</p>
            <p className="text-[10px] text-muted-foreground">Upload MP3, WAV, AAC or drop files here</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!projectId || !accessToken}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              Upload audio
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {audioAssets.map((asset) => (
              <div
                key={asset.id}
                className={`group relative rounded-lg border bg-card p-2.5 transition-all hover:border-emerald-500/50 ${
                  asset.error ? "border-red-500/40" : "border-border/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Preview toggle */}
                  <button
                    onClick={() => togglePreview(asset)}
                    disabled={asset.uploading || !!asset.error}
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40"
                  >
                    {previewId === asset.id ? (
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

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-foreground">{asset.name}</p>
                    <div className="mt-1">
                      {asset.uploading ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-emerald-400 transition-all"
                              style={{ width: `${asset.progress ?? 0}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground">{asset.progress ?? 0}%</span>
                        </div>
                      ) : (
                        <WaveformBars />
                      )}
                    </div>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">{formatDuration(asset.duration)}</p>
                  </div>

                  {/* Add to timeline */}
                  <button
                    onClick={() => handleAddToTimeline(asset)}
                    disabled={asset.uploading || !!asset.error}
                    className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-400 opacity-0 transition-opacity hover:bg-emerald-500/20 group-hover:opacity-100 disabled:opacity-0"
                    title="Add to timeline"
                  >
                    + Add
                  </button>
                </div>

                {asset.error && (
                  <p className="mt-1 text-[9px] text-red-400">{asset.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
