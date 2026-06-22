import { useEffect, useState } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { EditorTopbar } from "@/components/editor/EditorTopbar"
import { MediaPanel } from "@/components/editor/MediaPanel"
import { PreviewPanel } from "@/components/editor/PreviewPanel"
import { PropertiesPanel } from "@/components/editor/PropertiesPanel"
import { Timeline } from "@/components/editor/Timeline"
import { useEditorStore } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts"
import { realtimeService } from "@/services/realtimeService"

type LoadState = "init" | "loading" | "ready" | "missing" | "error" | "no-auth"

function Spinner() {
  return (
    <div className="grid place-items-center">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
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

  useEditorShortcuts()

  // Load project from URL or create one if none provided
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (authLoading) {
        setLoadState("init")
        return
      }
      if (!accessToken) {
        setLoadState("no-auth")
        return
      }
      if (projectIdFromUrl) {
        setLoadState("loading")
        await loadProject(projectIdFromUrl, accessToken)
        if (cancelled) return
        const state = useEditorStore.getState()
        if (state.projectError) {
          setLoadState("error")
          setErrorMsg(state.projectError)
        } else if (!state.project) {
          setLoadState("missing")
        } else {
          setLoadState("ready")
        }
      } else {
        // No project in URL — auto-create one so user lands in the editor
        setLoadState("loading")
        try {
          const created = await createProject("Untitled project", accessToken)
          if (cancelled) return
          navigate(`/editor?project=${created.id}`, { replace: true })
          setLoadState("ready")
        } catch (e) {
          if (cancelled) return
          setLoadState("error")
          setErrorMsg(e instanceof Error ? e.message : "Failed to create project")
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, accessToken, projectIdFromUrl])

  // Reset editor when leaving
  useEffect(() => {
    return () => {
      if (projectId) {
        realtimeService.leaveProject(projectId)
      }
      resetEditor()
    }
  }, [resetEditor, projectId])

  // Connect to WebSocket and join project room
  useEffect(() => {
    if (!accessToken) return
    realtimeService.connect(accessToken)
    
    if (projectId) {
      realtimeService.joinProject(projectId)
    }

    return () => {
      if (projectId) {
        realtimeService.leaveProject(projectId)
      }
    }
  }, [accessToken, projectId])

  // ─── Render guards ───────────────────────────────────────────────────────
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
        <div className="flex gap-2">
          <Link
            to="/projects"
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
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
        <Link
          to="/projects"
          className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
        >
          Back to projects
        </Link>
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
        <MediaPanel />
        <PreviewPanel />
        <PropertiesPanel />
      </div>
      <Timeline />
    </div>
  )
}