import { useEffect, useState } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { EditorTopbar } from "@/components/editor/EditorTopbar"
import { MediaPanel } from "@/components/editor/MediaPanel"
import { AudioPanel } from "@/components/editor/AudioPanel"
import { TextPanel } from "@/components/editor/TextPanel"
import { EffectsPanel } from "@/components/editor/EffectsPanel"
import { PreviewPanel } from "@/components/editor/PreviewPanel"
import { PropertiesPanel } from "@/components/editor/PropertiesPanel"
import { Timeline } from "@/components/editor/Timeline"
import { useEditorStore } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts"
import { realtimeService } from "@/services/realtimeService"

type LoadState = "init" | "loading" | "ready" | "missing" | "error" | "no-auth"
type SidebarTab = "media" | "audio" | "text" | "effects"

function Spinner() {
  return (
    <div className="grid place-items-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

function SidebarTabBtn({
  active, onClick, title, children,
}: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-[9px] font-medium transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

export function EditorPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const projectIdFromUrl = params.get("project")
  const { accessToken, isLoading: authLoading } = useAuth()

  const loadProject = useEditorStore((s) => s.loadProject)
  const createProject = useEditorStore((s) => s.createProject)
  const resetEditor = useEditorStore((s) => s.resetEditor)
  const loadingProject = useEditorStore((s) => s.loadingProject)
  const projectError = useEditorStore((s) => s.projectError)
  const project = useEditorStore((s) => s.project)
  const projectId = useEditorStore((s) => s.projectId)

  const [loadState, setLoadState] = useState<LoadState>("init")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SidebarTab>("media")

  useEditorShortcuts()

  // Hold a reference to the realtime socket for the lifetime of the
  // editor and leave the project when this page is unmounted.
  useEffect(() => {
    const release = realtimeService.acquire()
    return () => {
      if (projectId) realtimeService.leaveProject(projectId)
      release()
    }
  }, [projectId])

  // (Re)join the project room whenever the project changes.
  useEffect(() => {
    if (projectId) realtimeService.joinProject(projectId)
  }, [projectId])

  // Reset editor when leaving — only on unmount, not on projectId changes
  // (changing projectId would otherwise wipe the project we just loaded).
  useEffect(() => {
    return () => {
      const currentId = useEditorStore.getState().projectId
      if (currentId) {
        realtimeService.leaveProject(currentId)
      }
      resetEditor()
    }
  }, [resetEditor])

  // Resolve the access token directly from localStorage so the load
  // fires immediately on mount. If the auth context hasn't
  // initialised yet but we have a stored token, that's good enough
  // for the API call — `loadProject` will surface a 401/403 error
  // and the UI will route to the "Couldn't open project" screen
  // with the real message.
  const token = accessToken ??
    (typeof window !== "undefined"
      ? localStorage.getItem("accessToken")
      : null)
  const authReady = !!token

  // Load project from URL or create one if none provided
  useEffect(() => {
    if (!authReady || !token) return
    const tokenAtStart = token
    const projectIdAtStart = projectIdFromUrl
    let cancelled = false

    const run = async () => {
      setLoadState("loading")
      setErrorMsg(null)

      if (projectIdAtStart) {
        try {
          await loadProject(projectIdAtStart, tokenAtStart)
        } catch (e) {
          console.error("loadProject threw", e)
        }
        if (cancelled) return

        const state = useEditorStore.getState()
        if (state.projectError) {
          setLoadState("error")
          setErrorMsg(state.projectError)
        } else if (!state.project || !state.project.id) {
          setLoadState("missing")
        } else {
          setLoadState("ready")
        }
      } else {
        // No project in URL — auto-create one so user lands in the editor
        try {
          const created = await createProject("Untitled project", tokenAtStart)
          if (cancelled) return
          // Don't set ready yet — wait until the URL actually changes
          // and the next effect run loads the freshly created project.
          navigate(`/editor?project=${created.id}`, { replace: true })
        } catch (e) {
          if (cancelled) return
          setLoadState("error")
          setErrorMsg(
            e instanceof Error ? e.message : "Failed to create project",
          )
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdFromUrl, authReady, token])

  // ─── Render guards ───────────────────────────────────────────────────────
  if (loadState === "init") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Spinner />
        <p className="text-[12px] text-muted-foreground">Initializing…</p>
      </div>
    )
  }

  if (loadState === "no-auth" || (authLoading && !accessToken)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-[14px] font-medium">Sign in to edit projects</p>
        <p className="max-w-sm text-center text-[12px] text-muted-foreground">
          You need an account to upload media, save your work, and export
          videos.
        </p>
        <div className="flex gap-2">
          <Link
            to="/login"
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium hover:bg-muted"
          >
            Create account
          </Link>
        </div>
      </div>
    )
  }

  if (loadState === "loading" || loadingProject) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Spinner />
        <p className="text-[12px] text-muted-foreground">
          {projectIdFromUrl ? "Loading project…" : "Creating project…"}
        </p>
      </div>
    )
  }

  if (loadState === "error" || projectError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-[14px] font-medium">Couldn’t open project</p>
        <p className="max-w-sm text-center text-[12px] text-red-400">
          {errorMsg ?? projectError ?? "Unknown error"}
        </p>
        <p className="max-w-md text-center text-[10px] text-muted-foreground/60">
          ID: {projectIdFromUrl ?? "(none)"}
        </p>
        <div className="flex gap-2">
          <Link
            to="/dashboard"
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
          >
            Back to dashboard
          </Link>
          <Link
            to="/projects"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium hover:bg-muted"
          >
            Back to projects
          </Link>
        </div>
      </div>
    )
  }

  if (loadState === "missing" || (projectIdFromUrl && !project)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-[14px] font-medium">Project not found</p>
        <p className="max-w-sm text-center text-[12px] text-muted-foreground">
          The project you’re looking for doesn’t exist or has been deleted.
        </p>
        <p className="max-w-md text-center text-[10px] text-muted-foreground/60">
          ID: {projectIdFromUrl ?? "(none)"}
        </p>
        <div className="flex gap-2">
          <Link
            to="/dashboard"
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Spinner />
        <p className="text-[12px] text-muted-foreground">Preparing editor…</p>
      </div>
    )
  }

  // ─── Main editor ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <EditorTopbar />
      <div className="flex min-h-0 flex-1">
        {/* CapCut-style icon sidebar */}
        <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border/60 bg-card/80 py-2">
          <SidebarTabBtn active={activeTab === "media"} onClick={() => setActiveTab("media")} title="Media">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <rect x="2" y="7" width="15" height="10" rx="2" />
              <path d="m17 9 5-2v10l-5-2" />
            </svg>
            Media
          </SidebarTabBtn>
          <SidebarTabBtn active={activeTab === "audio"} onClick={() => setActiveTab("audio")} title="Audio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            Audio
          </SidebarTabBtn>
          <SidebarTabBtn active={activeTab === "text"} onClick={() => setActiveTab("text")} title="Text">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
            Text
          </SidebarTabBtn>
          <SidebarTabBtn active={activeTab === "effects"} onClick={() => setActiveTab("effects")} title="Effects">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
            Effects
          </SidebarTabBtn>
        </nav>

        {/* Panel content */}
        <div className="flex w-64 shrink-0 flex-col border-r border-border/60 bg-card/40">
          {activeTab === "media" && <MediaPanel />}
          {activeTab === "audio" && <AudioPanel />}
          {activeTab === "text" && <TextPanel />}
          {activeTab === "effects" && <EffectsPanel />}
        </div>

        <PreviewPanel />
        <PropertiesPanel />
      </div>
      <Timeline />
    </div>
  )
}
