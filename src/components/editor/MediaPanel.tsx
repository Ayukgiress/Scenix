import { useRef } from "react"
import { useEditorStore } from "@/store/editorStore"

function Icon({ name }: { name: string }) {
  const props = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "size-4" }
  switch (name) {
    case "upload": return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
    case "video": return <svg {...props}><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
    default: return null
  }
}

export function MediaPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaAssets = useEditorStore((state) => state.mediaAssets)
  const addMediaAsset = useEditorStore((state) => state.addMediaAsset)
  const addClip = useEditorStore((state) => state.addClip)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file)
      const type = file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image"
      
      // Get video duration
      let duration = 5 // default for images
      if (type === "video" || type === "audio") {
        const video = document.createElement(type)
        video.src = url
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            duration = video.duration
            resolve(null)
          }
        })
      }

      addMediaAsset({
        name: file.name,
        type,
        url,
        file,
        duration,
      })
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDragToTimeline = (asset: any) => {
    const clips = useEditorStore.getState().clips
    const lastClipEnd = clips.length > 0 
      ? Math.max(...clips.map(c => c.startTime + c.duration)) 
      : 0

    addClip({
      type: asset.type,
      url: asset.url,
      file: asset.file,
      startTime: lastClipEnd,
      duration: asset.duration || 5,
      track: 0,
      trimStart: 0,
      trimEnd: asset.duration || 5,
    })
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border/60 bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Media</span>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="rounded p-1 text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
          title="Upload media"
        >
          <Icon name="upload" />
        </button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {mediaAssets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <div className="grid size-12 place-items-center rounded-full border-2 border-dashed border-border">
            <Icon name="video" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-foreground">No media yet</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Upload videos, audio, or images</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Upload files
          </button>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-2">
          {mediaAssets.map((asset) => (
            <div
              key={asset.id}
              className="group relative cursor-pointer overflow-hidden rounded-md border border-border/60 bg-black transition-all hover:border-primary hover:shadow-lg"
              onClick={() => handleDragToTimeline(asset)}
              title="Click to add to timeline"
            >
              {asset.type === "video" ? (
                <video src={asset.url} className="aspect-video w-full object-cover" />
              ) : asset.type === "image" ? (
                <img src={asset.url} className="aspect-video w-full object-cover" alt={asset.name} />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <Icon name="video" />
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              
              <div className="absolute bottom-0 left-0 right-0 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="truncate text-[9px] font-medium text-white">{asset.name}</p>
                {asset.duration && (
                  <p className="text-[8px] text-white/70">{Math.floor(asset.duration)}s</p>
                )}
              </div>
              
              <div className="absolute right-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[8px] uppercase text-white backdrop-blur">
                {asset.type}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
