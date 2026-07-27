import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import { api, Media } from "@/lib/api"
import { DashboardLayout } from "@/layouts/DashboardLayout"

function Icon({ name, className = "size-4" }: { name: string; className?: string }) {
  const props = { viewBox: "0 0 24 24", className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (name) {
    case "file": return <svg {...props}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
    case "video": return <svg {...props}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    case "music": return <svg {...props}><circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/></svg>
    case "image": return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
    case "trash": return <svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    case "upload": return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    case "search": return <svg {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    default: return null
  }
}

function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return ""
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function MediaCard({ media, onDelete }: { media: Media; onDelete: (id: string) => void }) {
  const getIcon = () => {
    if (media.type.startsWith('video/')) return 'video'
    if (media.type.startsWith('audio/')) return 'music'
    if (media.type.startsWith('image/')) return 'image'
    return 'file'
  }

  return (
    <div className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-border/80 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-md border border-border bg-muted">
            <Icon name={getIcon()} className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{media.filename}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatFileSize(media.size)}</span>
              {media.duration && <span>• {formatDuration(media.duration)}</span>}
            </div>
          </div>
        </div>
        <button 
          onClick={() => onDelete(media.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        >
          <Icon name="trash" className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function MediaPage() {
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const { accessToken } = useAuth()
  const toast = useToast()

  const fetchMedia = async () => {
    if (!accessToken) return
    try {
      setLoading(true)
      const data = await api.getMedia(accessToken, {
        search: search || undefined,
        type: typeFilter === "all" ? undefined : typeFilter
      })
      setMedia(data)
    } catch (error) {
      console.error('Failed to fetch media:', error)
      toast.error('Failed to load media')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadMedia = async () => {
      if (!accessToken) return
      try {
        setLoading(true)
        const data = await api.getMedia(accessToken, {
          search: search || undefined,
          type: typeFilter === "all" ? undefined : typeFilter
        })
        setMedia(data)
      } catch (error) {
        console.error('Failed to fetch media:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMedia()
  }, [accessToken, search, typeFilter])

  const handleDelete = async (id: string) => {
    if (!accessToken) return
    if (!confirm('Delete this media file?')) return
    
    try {
      await api.deleteMedia(accessToken, id)
      toast.success('File deleted')
      await fetchMedia()
    } catch (error) {
      console.error('Failed to delete media:', error)
      toast.error('Failed to delete file')
    }
  }

  const filtered = media.filter(m => 
    m.filename.toLowerCase().includes(search.toLowerCase()) &&
    (typeFilter === "all" || m.type.startsWith(typeFilter))
  )

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/40 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Media Library</h1>
            <p className="text-sm text-muted-foreground">Manage your uploaded files</p>
          </div>
          <button className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Icon name="upload" className="size-4" />
            Upload files
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 rounded-md border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All types</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="image">Image</option>
          </select>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
            <Icon name="file" className="mb-3 size-12 opacity-30" />
            <p className="text-sm">No media files found</p>
            <p className="text-xs">Upload some files to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(m => (
              <MediaCard key={m.id} media={m} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
      </div>
    </DashboardLayout>
  )
}