import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useEditorStore } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"

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

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(projectTitle)
  const [savingTitle, setSavingTitle] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const shareRef = useRef<HTMLDivElement>(null)

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
      setEditingTitle(false)
    } catch (e) {
      console.error(e)
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
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error("Failed to copy link", e)
    }
  }

  const savedAgoText = formatSavedAgo(save.lastSavedAt)

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-card/60 px-3">
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