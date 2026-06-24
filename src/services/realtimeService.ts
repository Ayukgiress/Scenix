import { io, Socket } from "socket.io-client"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import { clipFromServer, type ServerClip } from "@/lib/api"

class RealtimeService {
  private socket: Socket | null = null
  private currentProjectId: string | null = null
  private currentToken: string | null = null
  private referenceCount = 0
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Mark the service as "needed". Returns a function that releases
   * the reference. When the reference count drops to zero the socket
   * is torn down (after a short delay so quick navigations don't flap).
   */
  acquire(): () => void {
    this.referenceCount += 1
    const token = this.currentToken ?? this.readStoredToken()
    if (token) this.connect(token)
    return () => this.release()
  }

  /**
   * Force a teardown — call on logout.
   */
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

  /**
   * Connect to the realtime WebSocket server. Idempotent — calling this
   * multiple times will only ever create one underlying socket.
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      this.currentToken = token
      return
    }
    if (this.socket) {
      // Reuse the in-flight socket if it exists but isn't connected yet,
      // but update the token so the latest one is used.
      this.currentToken = token
      return
    }
    this.currentToken = token

    const url =
      (import.meta.env.VITE_API_URL as string | undefined) ||
      "http://localhost:3000"

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
      // Backend URL unreachable / invalid — fail silently in the UI
      console.warn("Realtime service could not initialize:", err)
      this.socket = null
      return
    }

    this.socket.on("connect", () => {
      console.log("WebSocket connected")
      if (this.currentProjectId) {
        this.emitJoin(this.currentProjectId)
      }
    })

    this.socket.on("connect_error", (err) => {
      // Backend offline / unreachable — log and let socket.io keep retrying
      console.warn("Realtime connection error:", err.message)
    })

    this.socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason)
    })

    this.socket.on("project:updated", (project) => {
      const store = useEditorStore.getState()
      if (store.projectId === project.id) {
        store.setProject(project)
      }
    })

    this.socket.on("clip:created", (serverClip: ServerClip) => {
      const store = useEditorStore.getState()
      const local = this.toLocalClip(serverClip, store.mediaAssets)
      if (!local) return
      if (store.clips.some((c) => c.serverId === local.serverId)) return
      store.addClipLocal(local)
    })

    this.socket.on("clip:updated", (serverClip: ServerClip) => {
      const store = useEditorStore.getState()
      const local = this.toLocalClip(serverClip, store.mediaAssets)
      if (!local) return
      const existing = store.clips.find((c) => c.serverId === serverClip.id)
      if (existing) {
        store.updateClipLocal(existing.id, { ...local, id: existing.id })
      } else {
        store.addClipLocal(local)
      }
    })

    this.socket.on("clip:deleted", (data: { id: string }) => {
      const store = useEditorStore.getState()
      const existing = store.clips.find((c) => c.serverId === data.id)
      if (existing) {
        store.deleteClipLocal(existing.id)
      }
    })
  }

  disconnect() {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer)
      this.disconnectTimer = null
    }
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
      this.currentProjectId = null
    }
  }

  /**
   * Join a project room to start receiving clip/project events.
   */
  joinProject(projectId: string) {
    this.currentProjectId = projectId
    if (this.socket?.connected) {
      this.emitJoin(projectId)
    }
  }

  leaveProject(projectId: string) {
    if (this.socket?.connected) {
      this.socket.emit("leave-project", projectId)
    }
    if (this.currentProjectId === projectId) {
      this.currentProjectId = null
    }
  }

  private emitJoin(projectId: string) {
    this.socket?.emit("join-project", projectId)
  }

  /**
   * Convert a server clip (ms) into a LocalClip (seconds) and resolve
   * the mediaId against the project's known media assets.
   */
  private toLocalClip(
    serverClip: ServerClip,
    mediaAssets: ReturnType<typeof useEditorStore.getState>["mediaAssets"],
  ): LocalClip | null {
    const base = clipFromServer(serverClip)
    if (!base.mediaId) return null
    const media = mediaAssets.find((m) => m.serverId === base.mediaId)
    return {
      id: `srv_${base.id}`,
      serverId: base.id,
      mediaId: base.mediaId,
      type: media
        ? media.type === "audio"
          ? "audio"
          : media.type === "image"
            ? "image"
            : "video"
        : "video",
      url: media?.url,
      startTime: base.startTime,
      duration: base.duration,
      track: base.track,
      trimStart: base.trimStart,
      trimEnd: base.trimEnd,
      volume: 1,
      opacity: base.opacity,
      syncing: false,
      dirty: false,
    }
  }
}

export const realtimeService = new RealtimeService()
