import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useEditorStore } from "@/store/editorStore"

export function EditorTopbar() {
  const addMediaAsset = useEditorStore((state) => state.addMediaAsset)
  const addClip = useEditorStore((state) => state.addClip)
  
  const loadDemoVideo = async () => {
    const demoUrl = "/12779446_3840_2160_24fps.mp4"
    
    // Get video duration
    const video = document.createElement("video")
    video.src = demoUrl
    
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        const duration = video.duration
        
        addMediaAsset({
          name: "Demo Video",
          type: "video",
          url: demoUrl,
          duration,
        })
        
        addClip({
          type: "video",
          url: demoUrl,
          startTime: 0,
          duration: Math.min(duration, 30),
          track: 0,
          trimStart: 0,
          trimEnd: Math.min(duration, 30),
        })
        
        resolve(null)
      }
    })
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-card/60 px-3">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-6 place-items-center rounded bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m10 9 5 3-5 3z" fill="currentColor" />
            </svg>
          </span>
          Scenix
        </Link>
        <div className="ml-3 hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <span>My Projects</span>
          <span className="text-foreground/40">/</span>
          <span className="text-foreground">untitled.scenix</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={loadDemoVideo}>
          Load Demo
        </Button>
        <Button variant="outline" size="sm">Share</Button>
        <Button size="sm" asChild>
          <Link to="/export">Export</Link>
        </Button>
      </div>
    </header>
  )
}
