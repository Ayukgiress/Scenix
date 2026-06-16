import { Link } from "react-router-dom"
import { ExportDialog } from "@/components/export/ExportDialog"

export function ExportPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <header className="flex h-12 items-center justify-between border-b border-border/60 bg-card/60 px-4">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-6 place-items-center rounded bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m10 9 5 3-5 3z" fill="currentColor" />
            </svg>
          </span>
          Scenix
        </Link>
        <Link to="/editor" className="text-xs text-muted-foreground hover:text-foreground">
          Back to Editor
        </Link>
      </header>
      <ExportDialog />
    </div>
  )
}
