import { List, Grid, Upload, Trash2 } from "lucide-react"
import { useRef, useState, useCallback, useEffect } from "react"
import {
  useEditorStore,
  type LocalClip,
  type LocalMedia,
} from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import { api, uploadToCloudinary } from "@/lib/api"

type AssetType = "video" | "audio" | "image"
type ViewMode = "grid" | "list"

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
      kind === "audio"
        ? document.createElement("audio")
        : document.createElement("video")
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

function formatDuration(sec: number): string {
  if (typeof sec !== "number" || !isFinite(sec) || sec < 0) return "00:00.00"
  const minutes = Math.floor(sec / 60)
  const seconds = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 100)
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${ms.toString().padStart(2, "0")}`
}

function AssetPreview({
  asset,
  view,
}: {
  asset: LocalMedia
  view: ViewMode
}) {
  const commonClass =
    view === "grid"
      ? "h-full w-full object-cover"
      : "h-8 w-14 object-cover rounded"
  if (asset.type === "video") {
    return (
      <video
        src={asset.url}
        className={commonClass}
        muted
        playsInline
        preload="metadata"
      />
    )
  }
  if (asset.type === "image") {
    return (
      <img src={asset.url} alt={asset.name} className={commonClass} />
    )
  }
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-[10px] text-foreground/70 ${
        view === "grid" ? "h-full w-full" : "h-8 w-14 rounded"
      }`}
    >
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
  const [view, setView] = useState<ViewMode>("grid")
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<LocalMedia | null>(null)

  const toast = useToast()

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
        const msg = err instanceof Error ? err.message : "Upload failed"
        updateMediaAssetLocal(tempId, {
          uploading: false,
          progress: 0,
          error: msg,
        })
        toast.error(msg)
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
    setIsDeleting(asset)
  }

  const confirmDelete = async () => {
    if (!isDeleting) return
    if (!accessToken || !isDeleting.serverId) {
      removeMediaAssetLocal(isDeleting.id)
      setIsDeleting(null)
      return
    }
    try {
      await api.deleteMedia(accessToken, isDeleting.serverId)
      removeMediaAssetLocal(isDeleting.id)
      toast.success("Media deleted")
    } catch (err) {
      console.error("Failed to delete media", err)
      const msg = err instanceof Error ? err.message : "Failed to delete media"
      setError(msg)
      toast.error(msg)
    }
    setIsDeleting(null)
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
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Media
        </span>
        {mediaAssets.length > 0 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!projectId || !accessToken}
            className="rounded p-1 text-foreground/60 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            title={projectId ? "Upload media" : "Open a project first"}
          >
            <Upload className="size-4" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {mediaAssets.length > 0 && (
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
          <div className="flex items-center rounded-md border border-border bg-background">
            <button
              onClick={() => setView("list")}
              className={`px-1.5 py-1 ${
                view === "list"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="size-4" />
            </button>
            <button
              onClick={() => setView("grid")}
              className={`px-1.5 py-1 ${
                view === "grid"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid className="size-4" />
            </button>
          </div>
        </div>
      )}

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
        {isDeleting && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-lg bg-background p-4 shadow-lg">
              <p className="text-sm text-foreground">Are you sure you want to delete this file?</p>
              <p className="mt-1 text-xs text-muted-foreground">{isDeleting.name}</p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setIsDeleting(null)} className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80">
                  Cancel
                </button>
                <button onClick={confirmDelete} className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {mediaAssets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!projectId || !accessToken}
              className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 transition-colors hover:border-primary/60 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="size-8 text-muted-foreground" />
              <p className="mt-2 text-[12px] font-medium text-foreground">
                Drop files here or click to upload
              </p>
              <p className="text-[10px] text-muted-foreground">
                Supports video, audio, and images
              </p>
            </button>
          </div>
        ) : visibleAssets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-[12px] font-medium text-foreground">
              No matches found
            </p>
            <p className="text-[10px] text-muted-foreground">
              Try a different search or filter
            </p>
          </div>
        ) : view === "grid" ? (
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
                  <AssetPreview asset={asset} view="grid" />
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
                    <Trash2 className="size-3" />
                  </button>
                </div>
                <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[8px] uppercase text-white">
                  {asset.type}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {visibleAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className={`group flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors hover:bg-muted ${
                  asset.error
                    ? "bg-red-500/10"
                    : asset.uploading
                      ? "opacity-60"
                      : ""
                }`}
                disabled={asset.uploading || !!asset.error}
                onClick={() => handleAddToTimeline(asset)}
                title={asset.error ?? asset.name}
              >
                <div className="shrink-0">
                  <AssetPreview asset={asset} view="list" />
                </div>
                <div className="flex-1 truncate">
                  <p className="truncate text-[11px] font-medium">
                    {asset.name}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {formatDuration(asset.duration ?? 0)}
                  </p>
                </div>
                {asset.uploading && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>{asset.progress ?? 0}%</span>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteAsset(asset)
                  }}
                  className="ml-auto rounded p-1 text-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}