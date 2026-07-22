import { io, Socket } from "socket.io-client"
import { useEditorStore, type LocalClip, type LocalMedia } from "@/store/editorStore"
import { clipFromServer, type ServerClip, type Media, type Project } from "@/lib/api"

// ─── Presence ────────────────────────────────────────────────────────────────
export interface RemoteCursor {
  userId: string
  name: string
  color: string
  currentTime: number
  selectedClipId: string | null
  lastSeen: number
}

type CursorListener = (cursors: Map<string, RemoteCursor>) => void

class RealtimeService {
  private socket: Socket | null = null
  private currentProjectId: string | null = null
  private currentToken: string | null = null
  private referenceCount = 0
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null

  // Presence
  private remoteCursors = new Map<string, RemoteCursor>()
  private cursorListeners = new Set<CursorListener>()
  private cursorBroadcastTimer: ReturnType<typeof setTimeout> | null = null

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  acquire(): () => void {
    this.referenceCount += 1
    const token = this.currentToken ?? this.readStoredToken()
    if (token) this.connect(token)
    return () => this.release()
  }

  shutdown() {
    this.referenceCount = 0
    this.disconnect()
  }

  private release() {
    this.referenceCount = Math.max(0, this.referenceCount - 1)
    if (this.referenceCount > 0) return
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer)
    this.disconnectTimer = setTimeout(() => {
      this.disconnectTimer = null
      if (this.referenceCount === 0) this.disconnect()
    }, 1000)
  }

  private readStoredToken(): string | null {
    if (typeof window === "undefined") return null
    return localStorage.getItem("accessToken")
  }

  // ─── Connection ────────────────────────────────────────────────────────

  connect(token: string): void {
    if (this.socket?.connected) { this.currentToken = token; return }
    if (this.socket) { this.currentToken = token; return }
    this.currentToken = token

    const url = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:3000"

    try {
      this.socket = io(url, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 8000,
      })
    } catch (err) {
      console.warn("Realtime service could not initialize:", err)
      this.socket = null
      useEditorStore.getState().setConnectionStatus("error")
      return
    }

    useEditorStore.getState().setConnectionStatus("connecting")

    this.socket.on("connect", () => {
      useEditorStore.getState().setConnectionStatus("connected")
      if (this.currentProjectId) this.emitJoin(this.currentProjectId)
    })

    this.socket.on("connect_error", (err) => {
      console.warn("Realtime connection error:", err.message)
      useEditorStore.getState().setConnectionStatus("error")
    })

    this.socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason)
      useEditorStore.getState().setConnectionStatus(
        reason === "io client disconnect" ? "disconnected" : "connecting"
      )
    })

    this.socket.on("reconnect", () => {
      useEditorStore.getState().setConnectionStatus("connected")
      if (this.currentProjectId) this.emitJoin(this.currentProjectId)
    })

    // ─── Dashboard project events ────────────────────────────────────────

    this.socket.on("project:created", (project: Project) => {
      import("@/store/dashboardStore").then(({ useDashboardStore }) => {
        const { projects, stats } = useDashboardStore.getState()
        if (projects.some((p) => p.id === project.id)) return
        const newProject = serverProjectToDashboard(project, projects.length)
        useDashboardStore.setState((s) => ({
          projects: [newProject, ...s.projects],
          stats: { ...s.stats, totalProjects: s.stats.totalProjects + 1 },
          activities: [
            {
              id: `proj-created-${project.id}`,
              icon: "grid",
              text: `Project "${project.title}" created`,
              time: "Just now",
              timestamp: Date.now(),
            },
            ...s.activities,
          ].slice(0, 10),
        }))
      })
    })

    this.socket.on("project:status", (data: { id: string; status: string; progress?: number }) => {
      import("@/store/dashboardStore").then(({ useDashboardStore }) => {
        useDashboardStore.getState().updateProjectStatus(
          data.id,
          data.status as Parameters<ReturnType<typeof useDashboardStore.getState>["updateProjectStatus"]>[1],
        )
        if (data.progress !== undefined) {
          useDashboardStore.getState().updateProjectProgress(data.id, data.progress)
        }
      })
    })

    this.socket.on("project:deleted", (data: { id: string }) => {
      import("@/store/dashboardStore").then(({ useDashboardStore }) => {
        const project = useDashboardStore.getState().projects.find((p) => p.id === data.id)
        useDashboardStore.setState((s) => ({
          projects: s.projects.filter((p) => p.id !== data.id),
          stats: { ...s.stats, totalProjects: Math.max(0, s.stats.totalProjects - 1) },
          activities: [
            {
              id: `proj-deleted-${data.id}-${Date.now()}`,
              icon: "file",
              text: `Project "${project?.title ?? "Untitled"}" deleted`,
              time: "Just now",
              timestamp: Date.now(),
            },
            ...s.activities,
          ].slice(0, 10),
        }))
      })
    })

    // ─── Project events ─────────────────────────────────────────────────

    this.socket.on("project:updated", (project: { id: string; title: string; status: string }) => {
      const store = useEditorStore.getState()
      if (store.projectId === project.id) {
        store.setProject(project as Parameters<typeof store.setProject>[0])
      }
      // Also update dashboard card title/status
      import("@/store/dashboardStore").then(({ useDashboardStore }) => {
        useDashboardStore.setState((s) => ({
          projects: s.projects.map((p) =>
            p.id === project.id
              ? { ...p, title: project.title, status: project.status }
              : p,
          ),
        }))
      })
    })

    this.socket.on("project:renamed", (data: { id: string; title: string }) => {
      const store = useEditorStore.getState()
      if (store.projectId === data.id) store.setProjectTitle(data.title)
      import("@/store/dashboardStore").then(({ useDashboardStore }) => {
        useDashboardStore.setState((s) => ({
          projects: s.projects.map((p) =>
            p.id === data.id ? { ...p, title: data.title } : p,
          ),
        }))
      })
    })

    // ─── Clip events ─────────────────────────────────────────────────────

    this.socket.on("clip:created", (serverClip: ServerClip) => {
      const store = useEditorStore.getState()
      const local = this.toLocalClip(serverClip, store.mediaAssets)
      if (!local) return
      // Ignore if we already have this clip (we created it ourselves)
      if (store.clips.some((c) => c.serverId === local.serverId)) return
      store.addClipLocal(local)
    })

    this.socket.on("clip:updated", (serverClip: ServerClip) => {
      const store = useEditorStore.getState()
      const local = this.toLocalClip(serverClip, store.mediaAssets)
      if (!local) return
      const existing = store.clips.find((c) => c.serverId === serverClip.id)
      if (existing) {
        // Don't overwrite a clip that is currently being dragged (syncing=true)
        if (existing.syncing) return
        store.updateClipLocal(existing.id, { ...local, id: existing.id })
      } else {
        store.addClipLocal(local)
      }
    })

    this.socket.on("clip:deleted", (data: { id: string }) => {
      const store = useEditorStore.getState()
      const existing = store.clips.find((c) => c.serverId === data.id)
      if (existing) store.deleteClipLocal(existing.id)
    })

    // ─── Media events ─────────────────────────────────────────────────────

    this.socket.on("media:created", (serverMedia: Media) => {
      const store = useEditorStore.getState()
      // Only add if not already present (we may have added it optimistically)
      if (store.mediaAssets.some((m) => m.serverId === serverMedia.id)) return
      const local: LocalMedia = {
        id: `srv_${serverMedia.id}`,
        serverId: serverMedia.id,
        name: serverMedia.filename,
        type: (serverMedia.type as LocalMedia["type"]) || "video",
        url: serverMedia.url,
        duration: serverMedia.duration,
      }
      store.addMediaAssetLocal(local)
    })

    this.socket.on("media:deleted", (data: { id: string }) => {
      const store = useEditorStore.getState()
      const existing = store.mediaAssets.find((m) => m.serverId === data.id)
      if (existing) store.removeMediaAssetLocal(existing.id)
    })

    // Clip-specific effects are now managed per-clip, no global effects update needed


    // ─── Presence / cursor events ─────────────────────────────────────────

    this.socket.on("cursor:update", (cursor: RemoteCursor) => {
      this.remoteCursors.set(cursor.userId, { ...cursor, lastSeen: Date.now() })
      this.notifyCursorListeners()
    })

    this.socket.on("cursor:leave", (data: { userId: string }) => {
      this.remoteCursors.delete(data.userId)
      this.notifyCursorListeners()
    })

    // Prune stale cursors every 5s
    setInterval(() => {
      const now = Date.now()
      let changed = false
      for (const [id, c] of this.remoteCursors) {
        if (now - c.lastSeen > 10000) { this.remoteCursors.delete(id); changed = true }
      }
      if (changed) this.notifyCursorListeners()
    }, 5000)
  }

  disconnect() {
    if (this.disconnectTimer) { clearTimeout(this.disconnectTimer); this.disconnectTimer = null }
    if (this.cursorBroadcastTimer) { clearTimeout(this.cursorBroadcastTimer); this.cursorBroadcastTimer = null }
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
      this.currentProjectId = null
    }
    this.remoteCursors.clear()
    this.notifyCursorListeners()
  }

  // ─── Project room ──────────────────────────────────────────────────────

  joinProject(projectId: string) {
    this.currentProjectId = projectId
    if (this.socket?.connected) this.emitJoin(projectId)
  }

  leaveProject(projectId: string) {
    if (this.socket?.connected) this.socket.emit("leave-project", projectId)
    if (this.currentProjectId === projectId) this.currentProjectId = null
    this.remoteCursors.clear()
    this.notifyCursorListeners()
  }

  private emitJoin(projectId: string) {
    this.socket?.emit("join-project", projectId)
  }

  updateEffects(effects: string[]) {
    if (!this.socket?.connected || !this.currentProjectId) return
    this.socket.emit("effects:update", {
      projectId: this.currentProjectId,
      effects,
    })
  }

  // ─── Cursor presence ───────────────────────────────────────────────────

  broadcastCursor(data: { currentTime: number; selectedClipId: string | null }) {
    if (!this.socket?.connected || !this.currentProjectId) return
    // Throttle to max 10 fps
    if (this.cursorBroadcastTimer) return
    this.cursorBroadcastTimer = setTimeout(() => {
      this.cursorBroadcastTimer = null
      this.socket?.emit("cursor:update", {
        projectId: this.currentProjectId,
        ...data,
      })
    }, 100)
  }

  subscribeCursors(listener: CursorListener): () => void {
    this.cursorListeners.add(listener)
    return () => this.cursorListeners.delete(listener)
  }

  getRemoteCursors(): Map<string, RemoteCursor> {
    return this.remoteCursors
  }

  private notifyCursorListeners() {
    const snapshot = new Map(this.remoteCursors)
    for (const l of this.cursorListeners) l(snapshot)
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  get isConnected() {
    return this.socket?.connected ?? false
  }

  private toLocalClip(
    serverClip: ServerClip,
    mediaAssets: ReturnType<typeof useEditorStore.getState>["mediaAssets"],
  ): LocalClip | null {
    const base = clipFromServer(serverClip)
    const media = base.mediaId ? mediaAssets.find((m) => m.serverId === base.mediaId) : undefined
    const metadata = (serverClip.metadata as Record<string, unknown> | null) ?? undefined

    // Determine type: if no media but has text metadata → text clip
    const type: LocalClip["type"] = media
      ? media.type === "audio" ? "audio" : media.type === "image" ? "image" : "video"
      : metadata?.text !== undefined ? "text" : "video"

    // For text clips, reconstruct the url JSON payload from metadata
    const url = media?.url ?? (type === "text" && metadata ? JSON.stringify(metadata) : undefined)

    return {
      id: `srv_${serverClip.id}`,
      serverId: serverClip.id,
      mediaId: base.mediaId ?? "",
      type,
      url,
      startTime: base.startTime,
      duration: base.duration,
      track: base.track,
      trimStart: base.trimStart,
      trimEnd: base.trimEnd,
      volume: (metadata?.volume as number) ?? 1,
      opacity: base.opacity,
      rotation: base.rotation,
      zIndex: base.zIndex,
      x: base.x,
      y: base.y,
      width: base.width,
      height: base.height,
      metadata,
      syncing: false,
      dirty: false,
    }
  }
}

// ─── Dashboard helper ────────────────────────────────────────────────────────

function timeAgoMs(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diffMs / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return "Just now"
  if (h < 24) return `${h}h ago`
  if (d === 1) return "Yesterday"
  return `${d} days ago`
}

function serverProjectToDashboard(p: Project, index: number) {
  return {
    id: p.id,
    title: p.title,
    duration: "0:00",
    size: "0 MB",
    status: p.status,
    hue: 60 + (index * 70) % 300,
    updatedAt: timeAgoMs(p.updatedAt),
    thumb: [60 + (index * 70) % 300, 40 + (index * 50) % 280] as [number, number],
  }
}

export const realtimeService = new RealtimeService()