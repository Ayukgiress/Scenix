import { io, Socket } from "socket.io-client"
import { useEditorStore } from "@/store/editorStore"

interface ServerClip {
  id: string
  mediaAssetId: string
  startTimeMs: number
  durationMs: number
  trackIndex: number
  opacity?: number
}

class RealtimeService {
  private socket: Socket | null = null
  private currentProjectId: string | null = null
  private currentToken: string | null = null
  private started = false

  /**
   * Start the realtime service. Safe to call when the backend is offline —
   * it will try to connect and silently log errors instead of throwing.
   */
  start(token?: string) {
    this.started = true
    if (token) this.currentToken = token
    const t = this.currentToken ?? (typeof window !== "undefined" ? localStorage.getItem("accessToken") : null)
    if (t) this.connect(t)
  }

  /**
   * Stop the realtime service and tear down the socket.
   */
  stop() {
    this.started = false
    this.disconnect()
  }

  connect(token: string) {
    if (this.socket?.connected) return
    this.currentToken = token

    const url = import.meta.env.VITE_API_URL || "http://localhost:3000"

    try {
      this.socket = io(url, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        timeout: 5000,
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
        this.joinProject(this.currentProjectId)
      }
    })

    this.socket.on("connect_error", (err) => {
      // Backend offline / unreachable — log and let socket.io keep retrying
      console.warn("Realtime connection error:", err.message)
    })

    this.socket.on("disconnect", () => {
      console.log("WebSocket disconnected")
    })

    this.socket.on("project:updated", (project) => {
      const store = useEditorStore.getState()
      if (store.projectId === project.id) {
        store.setProject(project)
      }
    })

    this.socket.on("clip:created", (clip) => {
      const store = useEditorStore.getState()
      const localClip = this.mapServerClipToLocal(clip)
      store.addClipLocal(localClip)
    })

    this.socket.on("clip:updated", (clip) => {
      const store = useEditorStore.getState()
      const localClip = store.clips.find((c) => c.serverId === clip.id)
      if (localClip) {
        store.updateClipLocal(localClip.id, this.mapServerClipToLocal(clip))
      }
    })

    this.socket.on("clip:deleted", (data) => {
      const store = useEditorStore.getState()
      const localClip = store.clips.find((c) => c.serverId === data.id)
      if (localClip) {
        store.deleteClipLocal(localClip.id)
      }
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
      this.currentProjectId = null
    }
  }

  isStarted() {
    return this.started
  }

  joinProject(projectId: string) {
    if (!this.socket?.connected) return
    this.currentProjectId = projectId
    this.socket.emit("join-project", projectId)
  }

  leaveProject(projectId: string) {
    if (!this.socket?.connected) return
    this.socket.emit("leave-project", projectId)
    if (this.currentProjectId === projectId) {
      this.currentProjectId = null
    }
  }

  private mapServerClipToLocal(serverClip: ServerClip) {
    return {
      id: `srv_${serverClip.id}`,
      serverId: serverClip.id,
      mediaId: serverClip.mediaAssetId,
      type: "video" as const,
      url: undefined,
      startTime: serverClip.startTimeMs / 1000,
      duration: serverClip.durationMs / 1000,
      track: serverClip.trackIndex,
      trimStart: 0,
      trimEnd: serverClip.durationMs / 1000,
      volume: serverClip.opacity ?? 1,
    }
  }
}

export const realtimeService = new RealtimeService()
