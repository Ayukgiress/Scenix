import { useRef, useState, useCallback, useEffect } from "react"
import {
  useEditorStore,
  type LocalClip,
  type LocalMedia,
} from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import { api, uploadToCloudinary } from "@/lib/api"

type AssetType = "video" | "audio" | "image"

function detectAssetType(file: File): AssetType {
  if (file.type.startsWith("video")) return "video"
  if (file.type.startsWith("audio")) return "audio"
  return "image"
}

function readMediaDuration(file: File, kind: AssetType): Promise<number> {
  return new Promise((resolve) => {
    if (kind === "image") return resolve(5)
    const url = URL.createObjectURL(file)
    const el: HTMLMediaElement =
      kind === "audio" ? document.createElement("audio") : document.createElement("video")
    el.preload = "metadata"
    el.src = url
    el.onloadedmetadata = () => {
      const d = el.duration
      URL.revokeObjectURL(url)
      resolve(isFinite(d) && d > 0 ? d : 5)
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(5)
    }
  })
}

function localId() {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function AssetPreview({ asset }: { asset: LocalMedia }) {
  if (asset.type === "video") {
    return (
      <video
        src={asset.url}
        className="h-full w-full object-cover"
        muted
        playsInline
        preload="metadata"
      />
    )
  }
  if (asset.type === "image") {
    return (
      <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
    )
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-[10px] text-foreground/70">
      audio
    </div>
  )
}

export function MediaPanel() {
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

  const [uploadingCount, setUploadingCount] = useState(0)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | AssetType>("all")
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = useCallback(
    async (file: File) => {
      if (!accessToken) {
        setError("Please sign in to upload media")
        return
      }
      if (!projectId) {
        setError("Open a project first to upload media")
        return
      }
      const kind = detectAssetType(file)
      setError(null)
      const tempId = localId()
      const previewUrl = URL.createObjectURL(file)
      const optimistic: LocalMedia = {
        id: tempId,
        serverId: "",
        name: file.name,
        type: kind,
        url: previewUrl,
        uploading: true,
        progress: 0,
      }
      addMediaAssetLocal(optimistic)
      setUploadingCount((c) => c + 1)
      try {
        const localDuration = await readMediaDuration(file, kind)
        const signature = await api.createCloudinaryUpload(accessToken, {
          folder: `scenix/projects/${projectId}`,
          filename: file.name,
          type: (kind === "audio"
            ? "AUDIO"
            : kind === "video"
              ? "VIDEO"
              : "IMAGE") as "IMAGE" | "VIDEO" | "AUDIO" | "OTHER",
        })
        const uploaded = await uploadToCloudinary(file, signature, (pct) => {
          updateMediaAssetLocal(tempId, { progress: pct })
        })
        const persisted = await api.createMedia(accessToken, {
          filename: file.name,
          type: kind,
          size: uploaded.bytes ?? file.size,
          url: uploaded.secure_url,
          projectId,
          duration: uploaded.duration ?? localDuration,
        })
        updateMediaAssetLocal(tempId, {
          id: `srv_${persisted.id}`,
          serverId: persisted.id,
          url: persisted.url,
          name: persisted.filename,
          type: (persisted.type as AssetType) || kind,
          duration: persisted.duration ?? localDuration,
          uploading: false,
          progress: 100,
        })
        try {
          URL.revokeObjectURL(previewUrl)
        } catch {
          /* ignore */
        }
      } catch (err) {
        console.error("Upload failed", err)
        updateMediaAssetLocal(tempId, {
          uploading: false,
          progress: 0,
          error: err instanceof Error ? err.message : "Upload failed",
        })
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1))
      }
    },
    [accessToken, projectId, addMediaAssetLocal, updateMediaAssetLocal],
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(uploadFile)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      setDragOver(true)
    }
    const onDragLeave = (e: DragEvent) => {
      if (e.target === el) setDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = e.dataTransfer?.files
      if (files) Array.from(files).forEach(uploadFile)
    }
    el.addEventListener("dragover", onDragOver)
    el.addEventListener("dragleave", onDragLeave)
    el.addEventListener("drop", onDrop)
    return () => {
      el.removeEventListener("dragover", onDragOver)
      el.removeEventListener("dragleave", onDragLeave)
      el.removeEventListener("drop", onDrop)
    }
  }, [uploadFile])

  const handleAddToTimeline = async (asset: LocalMedia) => {
    if (asset.uploading || asset.error) return
    if (!asset.serverId || !accessToken) return
    const lastEnd = clips.reduce(
      (max, c) => Math.max(max, c.startTime + c.duration),
      0,
    )
    const duration = asset.duration && asset.duration > 0 ? asset.duration : 5
    const localClip: LocalClip = {
      id: localId(),
      mediaId: asset.serverId,
      type:
        asset.type === "audio"
          ? "audio"
          : asset.type === "image"
            ? "image"
            : "video",
      url: asset.url,
      startTime: lastEnd,
      duration,
      track: 0,
      trimStart: 0,
      trimEnd: duration,
      volume: 1,
    }
    addClipLocal(localClip)
    await syncAddClip(localClip, accessToken)
    // Surface the new clip in the Properties panel and jump the playhead
    // to its start so the user immediately sees where it landed.
    const latest = useEditorStore.getState().clips.find(
      (c) => c.id === localClip.id,
    )
    if (latest) {
      selectClip(latest.id)
      seek(latest.startTime)
    }
  }

  const handleDeleteAsset = async (asset: LocalMedia) => {
    if (!accessToken || !asset.serverId) {
      removeMediaAssetLocal(asset.id)
      return
    }
    try {
      await api.deleteMedia(accessToken, asset.serverId)
      removeMediaAssetLocal(asset.id)
    } catch (err) {
      console.error("Failed to delete media", err)
      setError(err instanceof Error ? err.message : "Failed to delete media")
    }
  }

  const visibleAssets = mediaAssets
    .filter((a) => filter === "all" || a.type === filter)
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div
      ref={dropRef}
      className={`relative flex h-full flex-col transition-colors ${
        dragOver ? "ring-2 ring-primary ring-inset" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Media
        </span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!projectId || !accessToken}
          className="rounded p-1 text-foreground/60 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          title={projectId ? "Upload media" : "Open a project first"}
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
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search media"
          className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:border-primary"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | AssetType)}
          className="h-7 rounded-md border border-border bg-background px-1.5 text-[10px] text-foreground outline-none focus:border-primary"
        >
          <option value="all">All</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="image">Image</option>
        </select>
      </div>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {uploadingCount > 0 && (
        <div className="border-b border-border/60 bg-primary/10 px-3 py-2 text-[10px] text-primary">
          Uploading {uploadingCount} {uploadingCount === 1 ? "file" : "files"}…
        </div>
      )}

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
          <div className="rounded-md border-2 border-dashed border-primary bg-background/80 px-4 py-3 text-[12px] font-medium text-foreground">
            Drop files to upload
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibleAssets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-[12px] font-medium text-foreground">
              {mediaAssets.length === 0 ? "No media yet" : "No matches"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {mediaAssets.length === 0
                ? "Drop video / audio / image files here"
                : "Try a different search or filter"}
            </p>
            {mediaAssets.length === 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!projectId || !accessToken}
                className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Upload files
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-2">
            {visibleAssets.map((asset) => (
              <div
                key={asset.id}
                className={`group relative overflow-hidden rounded-md border bg-black transition-all hover:border-primary hover:shadow-lg ${
                  asset.error
                    ? "border-red-500/50"
                    : asset.uploading
                      ? "border-border/40 opacity-80"
                      : "border-border/60"
                }`}
                title={asset.error ?? asset.name}
              >
                <button
                  type="button"
                  className="block aspect-video w-full bg-black"
                  disabled={asset.uploading || !!asset.error}
                  onClick={() => handleAddToTimeline(asset)}
                >
                  <AssetPreview asset={asset} />
                  {asset.uploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60">
                      <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-[10px] font-medium text-white">
                        {asset.progress ?? 0}%
                      </span>
                    </div>
                  )}
                </button>
                <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                  <span className="truncate text-[9px] text-foreground/80">
                    {asset.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteAsset(asset)
                    }}
                    className="rounded p-0.5 text-foreground/50 hover:bg-red-500/10 hover:text-red-400"
                    title="Delete"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
                <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[8px] uppercase text-white">
                  {asset.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}