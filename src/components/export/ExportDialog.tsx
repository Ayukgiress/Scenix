import { useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

type Format = "MP4" | "MOV" | "WebM" | "GIF"
type Resolution = "1080p" | "1440p" | "4K" | "8K"
type Fps = "24" | "30" | "60"

const resolutions: { id: Resolution; label: string; sub: string }[] = [
  { id: "1080p", label: "1080p", sub: "Full HD" },
  { id: "1440p", label: "1440p", sub: "QHD" },
  { id: "4K", label: "4K", sub: "Ultra HD" },
  { id: "8K", label: "8K", sub: "ProRes" },
]

const formats: Format[] = ["MP4", "MOV", "WebM", "GIF"]
const frameRates: Fps[] = ["24", "30", "60"]

export function ExportDialog() {
  const [filename, setFilename] = useState("video_30s_Final")
  const [format, setFormat] = useState<Format>("MP4")
  const [resolution, setResolution] = useState<Resolution>("4K")
  const [fps, setFps] = useState<Fps>("60")
  const [proRes, setProRes] = useState(true)
  const [twoPass, setTwoPass] = useState(true)

  return (
    <div className="grid min-h-screen place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Export Project</h2>
            <p className="text-[11px] text-muted-foreground">Choose your output format and quality</p>
          </div>
          <Link
            to="/editor"
            className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Link>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Filename
            </label>
            <div className="flex items-stretch overflow-hidden rounded-md border border-border/60 bg-background/60">
              <input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="my-video"
              />
              <span className="grid place-items-center border-l border-border/60 bg-muted/40 px-2 font-mono text-[11px] text-muted-foreground">
                .{format.toLowerCase()}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Resolution
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {resolutions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setResolution(r.id)}
                  className={`flex flex-col items-center rounded-md border px-2 py-2 text-xs transition-colors ${
                    resolution === r.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:border-foreground/40"
                  }`}
                >
                  <span className="font-semibold">{r.label}</span>
                  <span className="text-[10px] opacity-70">{r.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Format
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {formats.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                    format === f
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:border-foreground/40"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Frame Rate
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {frameRates.map((f) => (
                <button
                  key={f}
                  onClick={() => setFps(f)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                    fps === f
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:border-foreground/40"
                  }`}
                >
                  {f} fps
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 rounded-md border border-border/60 bg-background/40 p-3">
            <label className="flex cursor-pointer items-center justify-between text-xs text-foreground">
              <span>Use ProRes (Higher Quality)</span>
              <input
                type="checkbox"
                checked={proRes}
                onChange={(e) => setProRes(e.target.checked)}
                className="size-4 accent-primary"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between text-xs text-foreground">
              <span>Two-Pass Encoding (Smaller File)</span>
              <input
                type="checkbox"
                checked={twoPass}
                onChange={(e) => setTwoPass(e.target.checked)}
                className="size-4 accent-primary"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-5 py-3.5">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/editor">Cancel</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/editor">Save Draft</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/editor">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span className="ml-1.5">Download</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
