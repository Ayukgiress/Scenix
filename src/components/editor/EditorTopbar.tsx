import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useEditorStore, type ConnectionStatus } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import { LutPanel } from "@/components/editor/LutPanel"
import { Layers } from "lucide-react"

function Icon({ name, className = "size-4" }: { name: string; className?: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  }
  switch (name) {
    case "back":
      return (
        <svg {...props}>
          <path d="M19 12H5" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      )
    case "check":
      return (
        <svg {...props}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )
    case "share":
      return (
        <svg {...props}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      )
    case "spinner":
      return (
        <svg {...props} className={`${className} animate-spin`}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )
    case "loading":
      return (
        <svg {...props} className={`${className} animate-spin`}>
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      )
    case "cloud":
      return (
        <svg {...props}>
          <path d="M17.5 19a4.5 4.5 0 0 0 0-9 5.5 5.5 0 0 0-10.95-1A4 4 0 0 0 7 19h10.5z" />
        </svg>
      )
    default:
      return null
  }
}

function formatSavedAgo(savedAt: number | null): string {
  if (!savedAt) return "Not saved yet"
  const elapsedMs = Date.now() - savedAt
  const seconds = Math.max(1, Math.round(elapsedMs / 1000))
  if (seconds < 60) return `Saved ${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `Saved ${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return `Saved ${hours}h ago`
}

export function EditorTopbar() {
  const navigate = useNavigate()
  const { accessToken, user } = useAuth()
  const projectTitle = useEditorStore((s) => s.projectTitle)
  const renameProject = useEditorStore((s) => s.renameProject)
  const loadingProject = useEditorStore((s) => s.loadingProject)
  const save = useEditorStore((s) => s.save)
  const projectId = useEditorStore((s) => s.projectId)
  const connectionStatus = useEditorStore((s) => s.connectionStatus)

  const globalLut    = useEditorStore((s) => s.globalLut)
  const setGlobalLut = useEditorStore((s) => s.setGlobalLut)
  const [showGlobalLut, setShowGlobalLut] = useState(false)
  const globalLutRef = useRef<HTMLDivElement>(null)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(projectTitle)
  const [savingTitle, setSavingTitle] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [, setTick] = useState(0)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const shareRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  // Re-render the "Saved Xs ago" label every 15s so it stays accurate
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 15000)
    return () => window.clearInterval(id)
  }, [])

  // Toast on save error
  useEffect(() => {
    if (save.error) toast.error(`Save failed: ${save.error}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.error])

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus()
  }, [editingTitle])

  useEffect(() => {
    if (!showShare) return
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShowShare(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showShare])

  useEffect(() => {
    if (!showGlobalLut) return
    const handler = (e: MouseEvent) => {
      if (globalLutRef.current && !globalLutRef.current.contains(e.target as Node)) {
        setShowGlobalLut(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showGlobalLut])

  const handleStartEdit = () => {
    setTitleDraft(projectTitle)
    setEditingTitle(true)
  }

  const handleCancelEdit = () => {
    setTitleDraft(projectTitle)
    setEditingTitle(false)
  }

  const handleSaveTitle = async () => {
    if (!accessToken) return
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === projectTitle) {
      setEditingTitle(false)
      return
    }
    try {
      setSavingTitle(true)
      await renameProject(trimmed, accessToken)
      toast.success('Project renamed')
      setEditingTitle(false)
    } catch (e) {
      console.error(e)
      toast.error('Failed to rename project')
    } finally {
      setSavingTitle(false)
    }
  }

  const shareUrl = projectId
    ? `${window.location.origin}/editor?project=${projectId}`
    : window.location.href

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.info('Link copied to clipboard')
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error("Failed to copy link", e)
      toast.error('Failed to copy link')
    }
  }

  const savedAgoText = formatSavedAgo(save.lastSavedAt)

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-card/80 px-3 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/projects")}
          className="rounded p-1 text-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
          title="Back to projects"
        >
          <Icon name="back" />
        </button>
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-6 place-items-center rounded bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m10 9 5 3-5 3z" fill="currentColor" />
            </svg>
          </span>
          Scenix
        </Link>
        <div className="ml-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/projects" className="hover:text-foreground">
            My Projects
          </Link>
          <span className="text-foreground/40">/</span>
          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle()
                  if (e.key === "Escape") handleCancelEdit()
                }}
                onBlur={handleSaveTitle}
                disabled={savingTitle}
                className="h-6 w-48 rounded border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-primary"
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSaveTitle}
                disabled={savingTitle || !titleDraft.trim()}
                className="rounded p-0.5 text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-50"
                title="Save title"
              >
                {savingTitle ? (
                  <Icon name="spinner" className="size-3" />
                ) : (
                  <Icon name="check" className="size-3" />
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartEdit}
              disabled={!projectId || loadingProject}
              className="rounded px-1.5 py-0.5 text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              title={projectId ? "Rename project" : "Project not loaded"}
            >
              {loadingProject ? (
                <span className="inline-flex items-center gap-1">
                  <Icon name="loading" className="size-3" />
                  Loading…
                </span>
              ) : (
                projectTitle || "Untitled project"
              )}
            </button>
          )}
        </div>

        {/* Connection status */}
        <div className="ml-2 hidden items-center gap-1.5 text-[10px] md:flex">
          {connectionStatus === "connected" && (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />Live
            </span>
          )}
          {connectionStatus === "connecting" && (
            <span className="flex items-center gap-1 text-yellow-400">
              <span className="size-1.5 animate-pulse rounded-full bg-yellow-400" />Connecting
            </span>
          )}
          {connectionStatus === "error" && (
            <span className="flex items-center gap-1 text-red-400">
              <span className="size-1.5 rounded-full bg-red-400" />Offline
            </span>
          )}
          {connectionStatus === "disconnected" && (
            <span className="flex items-center gap-1 text-muted-foreground/50">
              <span className="size-1.5 rounded-full bg-muted-foreground/50" />Disconnected
            </span>
          )}
        </div>

        {/* Save indicator */}
        <div className="ml-2 hidden items-center gap-1.5 text-[10px] text-muted-foreground md:flex">
          {save.saving ? (
            <>
              <Icon name="cloud" className="size-3" />
              <span>Saving…</span>
            </>
          ) : save.error ? (
            <>
              <Icon name="cloud" className="size-3 text-red-400" />
              <span className="text-red-400" title={save.error}>
                Save error
              </span>
            </>
          ) : save.lastSavedAt ? (
            <>
              <Icon name="cloud" className="size-3 text-emerald-400" />
              <span>{savedAgoText}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {user && (
          <span className="hidden text-[11px] text-muted-foreground lg:inline">
            {user.email}
          </span>
        )}

        {/* Global LUT */}
        <div className="relative" ref={globalLutRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGlobalLut((v) => !v)}
            title="Global LUT"
            className={globalLut?.enabled ? "border-primary/60 text-primary" : ""}
          >
            <Layers className="mr-1 size-3" />
            LUT{globalLut?.enabled ? ` · ${Math.round(globalLut.intensity * 100)}%` : ""}
          </Button>
          {showGlobalLut && (
            <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border border-border bg-popover p-3 shadow-lg">
              <LutPanel label="Global LUT" lut={globalLut} onChange={setGlobalLut} />
            </div>
          )}
        </div>

        <div className="relative" ref={shareRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShare((v) => !v)}
            disabled={!projectId}
          >
            <Icon name="share" className="mr-1 size-3" />
            Share
          </Button>
          {showShare && (
            <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border border-border bg-popover p-2 shadow-lg">
              <p className="px-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Share project
              </p>
              <div className="flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1.5">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 truncate bg-transparent text-[11px] text-foreground outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopyLink}
                  className="rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:opacity-90"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="px-2 pt-1 text-[10px] text-muted-foreground">
                Anyone with the link can preview this project when signed in.
              </p>
            </div>
          )}
        </div>

        <Button size="sm" asChild>
          <Link to={projectId ? `/export?project=${projectId}` : "/export"}>
            Export
          </Link>
        </Button>
      </div>
    </header>
  )
}