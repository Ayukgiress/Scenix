import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import { Download, X, Loader2, Zap } from "lucide-react"

type Format = "MP4" | "MOV" | "WebM" | "GIF"
type Resolution = "720p" | "1080p" | "1440p" | "4K"
type Fps = "24" | "30" | "60"

const resolutions: { id: Resolution; label: string; sub: string }[] = [
  { id: "720p",  label: "720p",  sub: "HD" },
  { id: "1080p", label: "1080p", sub: "Full HD" },
  { id: "1440p", label: "1440p", sub: "QHD" },
  { id: "4K",    label: "4K",    sub: "Ultra HD" },
]
const formats: Format[] = ["MP4", "MOV", "WebM", "GIF"]
const frameRates: Fps[] = ["24", "30", "60"]

const SOCIAL_PRESETS = [
  { label: "YouTube",   format: "MP4" as Format, resolution: "1080p" as Resolution, fps: "30" as Fps, icon: "▶" },
  { label: "TikTok",    format: "MP4" as Format, resolution: "1080p" as Resolution, fps: "30" as Fps, icon: "♪" },
  { label: "Instagram", format: "MP4" as Format, resolution: "1080p" as Resolution, fps: "30" as Fps, icon: "◈" },
  { label: "Twitter/X", format: "MP4" as Format, resolution: "720p"  as Resolution, fps: "30" as Fps, icon: "✕" },
  { label: "GIF",       format: "GIF" as Format, resolution: "720p"  as Resolution, fps: "24" as Fps, icon: "◎" },
  { label: "4K Master", format: "MOV" as Format, resolution: "4K"    as Resolution, fps: "60" as Fps, icon: "★" },
]

type ExportPhase = "idle" | "submitting" | "polling" | "done" | "error"

export function ExportDialog() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const projectId = params.get("project")
  const { accessToken } = useAuth()

  const [filename,   setFilename]   = useState("video_export")
  const [format,     setFormat]     = useState<Format>("MP4")
  const [resolution, setResolution] = useState<Resolution>("1080p")
  const [fps,        setFps]        = useState<Fps>("30")
  const [proRes,     setProRes]     = useState(false)
  const [twoPass,    setTwoPass]    = useState(false)
  const [showPresets, setShowPresets] = useState(false)

  const [phase,      setPhase]      = useState<ExportPhase>("idle")
  const [progress,   setProgress]   = useState(0)
  const [outputUrl,  setOutputUrl]  = useState<string | null>(null)
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)
  const [exportId,   setExportId]   = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  const startPolling = (id: string) => {
    if (!accessToken) return
    pollRef.current = setInterval(async () => {
      try {
        const job = await api.getExport(accessToken, id)
        setProgress(job.progress ?? 0)
        if (job.status === "COMPLETED" || job.status === "completed") {
          stopPolling()
          setOutputUrl(job.outputUrl ?? null)
          setPhase("done")
        } else if (job.status === "FAILED" || job.status === "failed") {
          stopPolling()
          setErrorMsg("Export failed on the server.")
          setPhase("error")
        }
      } catch {
        // keep polling — transient network error
      }
    }, 2000)
  }

  const handleExport = async () => {
    if (!accessToken || !projectId) {
      setErrorMsg("No project loaded. Open a project in the editor first.")
      setPhase("error")
      return
    }
    setPhase("submitting")
    setErrorMsg(null)
    setProgress(0)
    try {
      const job = await api.createExport(accessToken, {
        projectId,
        format: format.toLowerCase(),
        quality: resolution,
        settings: { fps, proRes, twoPass, filename },
      })
      setExportId(job.id)
      setPhase("polling")
      startPolling(job.id)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to start export")
      setPhase("error")
    }
  }

  const handleCancel = async () => {
    stopPolling()
    if (accessToken && exportId) {
      try { await api.cancelExport(accessToken, exportId) } catch { /* ignore */ }
    }
    setPhase("idle")
    setProgress(0)
    setExportId(null)
  }

  const handleClose = () => navigate(-1)

  const busy = phase === "submitting" || phase === "polling"

  return (
    <div className="grid min-h-screen place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Export Project</h2>
            <p className="text-[11px] text-muted-foreground">Choose your output format and quality</p>
          </div>
          <button
            onClick={handleClose}
            className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Social presets */}
          <div>
            <button
              onClick={() => setShowPresets((v) => !v)}
              className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs text-foreground hover:bg-muted/40"
              disabled={busy}
            >
              <span className="flex items-center gap-1.5"><Zap className="size-3 text-primary" /> Quick presets</span>
              <span className="text-muted-foreground">{showPresets ? "▲" : "▼"}</span>
            </button>
            {showPresets && (
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {SOCIAL_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    disabled={busy}
                    onClick={() => { setFormat(p.format); setResolution(p.resolution); setFps(p.fps); setShowPresets(false) }}
                    className="flex flex-col items-center gap-0.5 rounded-md border border-border/60 bg-background/40 px-2 py-2 text-center text-xs hover:border-primary/50 hover:bg-muted/40 disabled:opacity-50"
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="font-medium text-foreground">{p.label}</span>
                    <span className="text-[9px] text-muted-foreground">{p.resolution} {p.fps}fps</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Filename */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Filename
            </label>
            <div className="flex items-stretch overflow-hidden rounded-md border border-border/60 bg-background/60">
              <input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                disabled={busy}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
                placeholder="my-video"
              />
              <span className="grid place-items-center border-l border-border/60 bg-muted/40 px-2 font-mono text-[11px] text-muted-foreground">
                .{format.toLowerCase()}
              </span>
            </div>
          </div>

          {/* Resolution */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Resolution
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {resolutions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setResolution(r.id)}
                  disabled={busy}
                  className={`flex flex-col items-center rounded-md border px-2 py-2 text-xs transition-colors disabled:opacity-50 ${
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

          {/* Format */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Format
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {formats.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  disabled={busy}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
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

          {/* Frame Rate */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Frame Rate
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {frameRates.map((f) => (
                <button
                  key={f}
                  onClick={() => setFps(f)}
                  disabled={busy}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
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

          {/* Options */}
          <div className="space-y-1.5 rounded-md border border-border/60 bg-background/40 p-3">
            <label className="flex cursor-pointer items-center justify-between text-xs text-foreground">
              <span>Use ProRes (Higher Quality)</span>
              <input type="checkbox" checked={proRes} onChange={(e) => setProRes(e.target.checked)} disabled={busy} className="size-4 accent-primary" />
            </label>
            <label className="flex cursor-pointer items-center justify-between text-xs text-foreground">
              <span>Two-Pass Encoding (Smaller File)</span>
              <input type="checkbox" checked={twoPass} onChange={(e) => setTwoPass(e.target.checked)} disabled={busy} className="size-4 accent-primary" />
            </label>
          </div>

          {/* Progress */}
          {(phase === "polling" || phase === "done") && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {phase === "done" ? "Export complete" : "Exporting…"}
                </span>
                <span className="font-mono text-foreground">{progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${phase === "done" ? 100 : progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {phase === "error" && errorMsg && (
            <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
              {errorMsg}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-5 py-3.5">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>

          {phase === "done" && outputUrl ? (
            <Button size="sm" asChild>
              <a href={outputUrl} download={`${filename}.${format.toLowerCase()}`} target="_blank" rel="noreferrer">
                <Download className="mr-1.5 size-3.5" />
                Download
              </a>
            </Button>
          ) : phase === "polling" ? (
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Cancel export
            </Button>
          ) : (
            <Button size="sm" onClick={handleExport} disabled={busy || !projectId}>
              {phase === "submitting" ? (
                <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Starting…</>
              ) : (
                <><Download className="mr-1.5 size-3.5" />Export</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
