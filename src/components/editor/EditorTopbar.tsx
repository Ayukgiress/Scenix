import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function EditorTopbar() {
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
          <span className="text-foreground">video_30s.scenix</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">Save & Exit</Link>
        </Button>
        <Button variant="outline" size="sm">Share</Button>
        <Button size="sm" asChild>
          <Link to="/export">Export</Link>
        </Button>
      </div>
    </header>
  )
}
