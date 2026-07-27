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
import { SubtitlePanel } from "@/components/editor/SubtitlePanel"
import { VoiceoverPanel } from "@/components/editor/VoiceoverPanel"
import { useEditorStore } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import { useEditorShortcuts, shortcutHelpBus } from "@/hooks/useEditorShortcuts"
import { realtimeService } from "@/services/realtimeService"
import { X } from "lucide-react"

const SHORTCUTS = [
  { key: "Space",          desc: "Play / Pause" },
  { key: "L",              desc: "Play forward (repeat = faster: ×1 ×2 ×4 ×8)" },
  { key: "J",              desc: "Play reverse (repeat = faster)" },
  { key: "K",              desc: "Pause" },
  { key: ", / .",          desc: "Step one frame back / forward" },
  { key: "I",              desc: "Set in point (toggle)" },
  { key: "O",              desc: "Set out point (toggle)" },
  { key: "S",              desc: "Split clip at playhead" },
  { key: "T",              desc: "Cycle trim tool (Select → Trim → Ripple → Roll → Slip → Slide)" },
  { key: "[",              desc: "Select left edge for JKL trim" },
  { key: "]",              desc: "Select right edge for JKL trim" },
  { key: "J / K / L",     desc: "Scrub trim edge (when trim tool + edge active)" },
  { key: "M",              desc: "Mute / unmute selected clip" },
  { key: "Delete",         desc: "Delete selected clip" },
  { key: "← / →",         desc: "Seek 1 second" },
  { key: "Shift + ← / →", desc: "Seek 5 seconds" },
  { key: "Home / End",     desc: "Jump to start / end" },
  { key: "+ / -",          desc: "Zoom in / out" },
  { key: "Ctrl+Z",         desc: "Undo" },
  { key: "Ctrl+Shift+Z",   desc: "Redo" },
  { key: "Escape",         desc: "Deselect clip" },
  { key: "?",              desc: "Show this help" },
]

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[13px] font-semibold text-foreground">Keyboard shortcuts</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="divide-y divide-border/60">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between px-4 py-2">
              <span className="text-[11px] text-muted-foreground">{s.desc}</span>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">{s.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type LoadState = "init" | "loading" | "ready" | "missing" | "error" | "no-auth"
type SidebarTab = "media" | "audio" | "text" | "effects" | "subtitles" | "voiceover"

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
  const [activeTab, setActiveTab] = useState<SidebarTab>("media")
  const [showShortcuts, setShowShortcuts] = useState(false)

  useEditorShortcuts()

  useEffect(() => {
    const unsubscribe = shortcutHelpBus.subscribe(() => setShowShortcuts(true))
    return () => { unsubscribe() }
  }, [])

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
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      <EditorTopbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="flex w-64 shrink-0 flex-col border-r border-border bg-card/60">
          <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border px-2">
            {(["media", "audio", "text", "effects", "subtitles", "voiceover"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "media" && <MediaPanel />}
            {activeTab === "audio" && <AudioPanel />}
            {activeTab === "text" && <TextPanel />}
            {activeTab === "effects" && <EffectsPanel />}
            {activeTab === "subtitles" && <SubtitlePanel />}
            {activeTab === "voiceover" && <VoiceoverPanel />}
          </div>
        </div>

        {/* Center Panel */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            <PreviewPanel />
          </div>
          <Timeline />
        </div>

        {/* Right Panel */}
        <div className="shrink-0 border-l border-border bg-card/60">
          <PropertiesPanel />
        </div>
      </div>
    </div>
  );
}