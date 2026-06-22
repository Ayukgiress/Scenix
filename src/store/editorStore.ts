import { create } from "zustand"
import type { TimelineClip, PlaybackState, MediaAsset } from "@/types/editor"
import { api, type Clip, type Media, type Project } from "@/lib/api"

// We keep two parallel representations:
//  - Local optimistic clips (TimelineClip) drive UI immediately
//  - Server clips (Clip from /projects/:id/clips) are the source of truth
//
// Each TimelineClip carries `mediaId` linking it to a Media asset whose
// `url` is what the video element actually plays.

export type ClipType = "video" | "audio" | "image" | "text"

export interface LocalClip extends Omit<TimelineClip, "file"> {
  // Backend identifiers
  serverId?: string // Clip.id once persisted
  mediaId: string   // Media.id this clip is built on (required for backend)
  // Local-only helpers
  syncing?: boolean
  dirty?: boolean
}

export interface LocalMedia extends Omit<MediaAsset, "file"> {
  serverId: string // Media.id from backend
  uploading?: boolean
  progress?: number
  error?: string
}

export interface SaveState {
  lastSavedAt: number | null
  saving: boolean
  error: string | null
}

interface EditorState {
  // Project
  project: Project | null
  projectId: string | null
  projectTitle: string
  projectStatus: string
  loadingProject: boolean
  projectError: string | null

  // Content
  clips: LocalClip[]
  mediaAssets: LocalMedia[]

  // Playback
  playback: PlaybackState
  selectedClipId: string | null
  zoom: number

  // UI
  save: SaveState

  // ─── Project lifecycle ──────────────────────────────────────────────────
  setProject: (project: Project) => void
  setProjectTitle: (title: string) => void
  setProjectStatus: (status: string) => void
  loadProject: (projectId: string, token: string) => Promise<void>
  createProject: (title: string, token: string) => Promise<Project>
  renameProject: (title: string, token: string) => Promise<void>

  // ─── Playback ──────────────────────────────────────────────────────────
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  setPlaybackRate: (rate: number) => void

  // ─── Clips ─────────────────────────────────────────────────────────────
  setClips: (clips: LocalClip[]) => void
  addClipLocal: (clip: LocalClip) => void
  updateClipLocal: (id: string, updates: Partial<LocalClip>) => void
  deleteClipLocal: (id: string) => void
  selectClip: (id: string | null) => void

  // Clip sync (server-authoritative wrappers)
  syncAddClip: (clip: LocalClip, token: string) => Promise<LocalClip | null>
  syncUpdateClip: (id: string, updates: Partial<LocalClip>, token: string) => Promise<void>
  syncDeleteClip: (id: string, token: string) => Promise<void>

  // ─── Media ─────────────────────────────────────────────────────────────
  setMediaAssets: (assets: LocalMedia[]) => void
  addMediaAssetLocal: (asset: LocalMedia) => void
  updateMediaAssetLocal: (id: string, updates: Partial<LocalMedia>) => void
  removeMediaAssetLocal: (id: string) => void

  // ─── Timeline ──────────────────────────────────────────────────────────
  setZoom: (zoom: number) => void

  // ─── Save state ────────────────────────────────────────────────────────
  setSaveState: (state: Partial<SaveState>) => void
  resetEditor: () => void
}

const initialPlayback: PlaybackState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  playbackRate: 1,
}

// Convert server Clip → LocalClip (without media lookup)
function serverClipToLocal(server: Clip): LocalClip {
  const duration = Math.max(0.1, (server.endTime ?? 0) - (server.startTime ?? 0))
  return {
    id: `srv_${server.id}`,
    serverId: server.id,
    mediaId: server.mediaId,
    type: "video", // refined below when media is loaded
    url: undefined,
    startTime: server.startTime ?? 0,
    duration,
    track: server.trackIndex ?? 0,
    trimStart: server.trimStart ?? 0,
    trimEnd: server.trimEnd ?? duration,
    volume: 1,
  }
}

function serverMediaToLocal(server: Media): LocalMedia {
  return {
    id: `srv_${server.id}`,
    serverId: server.id,
    name: server.filename,
    type: (server.type as LocalMedia["type"]) || "video",
    url: server.url,
    duration: server.duration,
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  projectId: null,
  projectTitle: "Untitled project",
  projectStatus: "draft",
  loadingProject: false,
  projectError: null,

  clips: [],
  mediaAssets: [],
  playback: { ...initialPlayback },
  selectedClipId: null,
  zoom: 1,
  save: { lastSavedAt: null, saving: false, error: null },

  // ─── Project lifecycle ──────────────────────────────────────────────────
  setProject: (project) =>
    set({
      project,
      projectId: project.id,
      projectTitle: project.title,
      projectStatus: project.status,
    }),

  setProjectTitle: (title) => set({ projectTitle: title }),
  setProjectStatus: (status) => set({ projectStatus: status }),

  loadProject: async (projectId, token) => {
    set({ loadingProject: true, projectError: null })
    try {
      const project = await api.getProject(token, projectId)
      const [serverClips, serverMedia] = await Promise.all([
        api.getClips(token, projectId).catch(() => [] as Clip[]),
        api.getMedia(token, { projectId }).catch(() => [] as Media[]),
      ])

      const mediaAssets = serverMedia.map(serverMediaToLocal)
      const mediaByServerId = new Map(mediaAssets.map((m) => [m.serverId, m]))
      const clips: LocalClip[] = serverClips.map((sc) => {
        const local = serverClipToLocal(sc)
        const media = mediaByServerId.get(sc.mediaId)
        if (media) {
          local.mediaId = media.serverId
          local.url = media.url
          local.type =
            media.type === "audio"
              ? "audio"
              : media.type === "image"
                ? "image"
                : "video"
        }
        return local
      })

      // Compute duration from clips
      const duration = clips.reduce(
        (max, c) => Math.max(max, c.startTime + c.duration),
        0,
      )

      set({
        project,
        projectId: project.id,
        projectTitle: project.title,
        projectStatus: project.status,
        clips,
        mediaAssets,
        playback: { ...initialPlayback, duration },
        loadingProject: false,
      })
    } catch (err) {
      console.error("Failed to load project", err)
      set({
        loadingProject: false,
        projectError: err instanceof Error ? err.message : "Failed to load project",
      })
    }
  },

  createProject: async (title, token) => {
    const project = await api.createProject(token, { title })
    set({
      project,
      projectId: project.id,
      projectTitle: project.title,
      projectStatus: project.status,
      clips: [],
      mediaAssets: [],
      playback: { ...initialPlayback },
    })
    return project
  },

  renameProject: async (title, token) => {
    const { projectId, project } = get()
    if (!projectId || !project) return
    const optimisticTitle = title.trim()
    if (!optimisticTitle) return
    set({ projectTitle: optimisticTitle, save: { ...get().save, saving: true } })
    try {
      const updated = await api.updateProject(token, projectId, { title: optimisticTitle })
      set({
        project: updated,
        projectTitle: updated.title,
        projectStatus: updated.status,
        save: { lastSavedAt: Date.now(), saving: false, error: null },
      })
    } catch (err) {
      console.error("Failed to rename project", err)
      set({
        projectTitle: project.title,
        save: {
          ...get().save,
          saving: false,
          error: err instanceof Error ? err.message : "Failed to rename project",
        },
      })
      throw err
    }
  },

  // ─── Playback ──────────────────────────────────────────────────────────
  play: () =>
    set((state) => ({ playback: { ...state.playback, isPlaying: true } })),
  pause: () =>
    set((state) => ({ playback: { ...state.playback, isPlaying: false } })),
  togglePlay: () =>
    set((state) => ({
      playback: { ...state.playback, isPlaying: !state.playback.isPlaying },
    })),
  seek: (time) => {
    const { playback } = get()
    const clamped = Math.max(0, Math.min(playback.duration || time, time))
    set({
      playback: {
        ...playback,
        currentTime: clamped,
        isPlaying: false,
      },
    })
  },
  setCurrentTime: (time) =>
    set((state) => ({
      playback: { ...state.playback, currentTime: Math.max(0, time) },
    })),
  setDuration: (duration) =>
    set((state) => ({
      playback: { ...state.playback, duration: Math.max(0, duration) },
    })),
  setVolume: (volume) =>
    set((state) => ({
      playback: { ...state.playback, volume: Math.max(0, Math.min(1, volume)) },
    })),
  setPlaybackRate: (rate) =>
    set((state) => ({
      playback: { ...state.playback, playbackRate: rate },
    })),

  // ─── Clips (local) ─────────────────────────────────────────────────────
  setClips: (clips) => set({ clips }),

  addClipLocal: (clip) =>
    set((state) => {
      const newClips = [...state.clips, clip]
      const duration = Math.max(
        state.playback.duration,
        clip.startTime + clip.duration,
      )
      return {
        clips: newClips,
        playback: { ...state.playback, duration },
      }
    }),

  updateClipLocal: (id, updates) =>
    set((state) => {
      const clips = state.clips.map((c) => (c.id === id ? { ...c, ...updates, dirty: true } : c))
      const duration = clips.reduce(
        (max, c) => Math.max(max, c.startTime + c.duration),
        state.playback.duration,
      )
      return {
        clips,
        playback: { ...state.playback, duration },
      }
    }),

  deleteClipLocal: (id) =>
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== id),
      selectedClipId: state.selectedClipId === id ? null : state.selectedClipId,
    })),

  selectClip: (id) => set({ selectedClipId: id }),

  // ─── Clip sync ─────────────────────────────────────────────────────────
  syncAddClip: async (clip, token) => {
    const { projectId } = get()
    if (!projectId) return null
    set({ save: { ...get().save, saving: true, error: null } })
    try {
      const serverClip = await api.createClip(token, projectId, {
        mediaId: clip.mediaId,
        trackIndex: clip.track ?? 0,
        startTime: clip.startTime,
        endTime: clip.startTime + clip.duration,
        trimStart: clip.trimStart ?? 0,
        trimEnd: clip.trimEnd ?? clip.duration,
        position: clip.startTime,
      })
      const updated: LocalClip = {
        ...clip,
        id: `srv_${serverClip.id}`,
        serverId: serverClip.id,
        syncing: false,
        dirty: false,
      }
      set((state) => ({
        clips: state.clips.map((c) => (c.id === clip.id ? updated : c)),
        save: { lastSavedAt: Date.now(), saving: false, error: null },
      }))
      return updated
    } catch (err) {
      console.error("Failed to create clip", err)
      set({
        save: {
          ...get().save,
          saving: false,
          error: err instanceof Error ? err.message : "Failed to save clip",
        },
      })
      // Rollback
      set((state) => ({ clips: state.clips.filter((c) => c.id !== clip.id) }))
      return null
    }
  },

  syncUpdateClip: async (id, updates, token) => {
    const { projectId, clips } = get()
    const clip = clips.find((c) => c.id === id)
    if (!projectId || !clip) return
    if (!clip.serverId) {
      // No server id yet - try to create it
      await get().syncAddClip(clip, token)
      return
    }
    // Optimistic mark
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, syncing: true } : c)),
      save: { ...get().save, saving: true, error: null },
    }))
    try {
      const merged = { ...clip, ...updates }
      const serverClip = await api.updateClip(token, projectId, clip.serverId, {
        mediaId: merged.mediaId,
        trackIndex: merged.track,
        startTime: merged.startTime,
        endTime: merged.startTime + merged.duration,
        trimStart: merged.trimStart,
        trimEnd: merged.trimEnd,
        position: merged.startTime,
      })
      set((state) => ({
        clips: state.clips.map((c) =>
          c.id === id
            ? {
                ...c,
                ...updates,
                syncing: false,
                dirty: false,
                // Re-sync authoritative values
                startTime: serverClip.startTime,
                duration: Math.max(0.1, serverClip.endTime - serverClip.startTime),
                track: serverClip.trackIndex,
                trimStart: serverClip.trimStart,
                trimEnd: serverClip.trimEnd,
              }
            : c
        ),
        save: { lastSavedAt: Date.now(), saving: false, error: null },
      }))
    } catch (err) {
      console.error("Failed to update clip", err)
      set((state) => ({
        clips: state.clips.map((c) => (c.id === id ? { ...c, syncing: false } : c)),
        save: {
          ...get().save,
          saving: false,
          error: err instanceof Error ? err.message : "Failed to save clip",
        },
      }))
    }
  },

  syncDeleteClip: async (id, token) => {
    const { projectId, clips } = get()
    const clip = clips.find((c) => c.id === id)
    if (!projectId) return
    const previous = clip
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== id),
      selectedClipId: state.selectedClipId === id ? null : state.selectedClipId,
    }))
    if (!clip?.serverId) return
    try {
      await api.deleteClip(token, projectId, clip.serverId)
    } catch (err) {
      console.error("Failed to delete clip", err)
      if (previous) {
        set((state) => ({ clips: [...state.clips, previous] }))
      }
      set({
        save: {
          ...get().save,
          error: err instanceof Error ? err.message : "Failed to delete clip",
        },
      })
    }
  },

  // ─── Media ─────────────────────────────────────────────────────────────
  setMediaAssets: (assets) => set({ mediaAssets: assets }),

  addMediaAssetLocal: (asset) =>
    set((state) => ({ mediaAssets: [...state.mediaAssets, asset] })),

  updateMediaAssetLocal: (id, updates) =>
    set((state) => ({
      mediaAssets: state.mediaAssets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  removeMediaAssetLocal: (id) =>
    set((state) => ({
      mediaAssets: state.mediaAssets.filter((a) => a.id !== id),
    })),

  // ─── Timeline ──────────────────────────────────────────────────────────
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),

  // ─── Save state ────────────────────────────────────────────────────────
  setSaveState: (state) => set({ save: { ...get().save, ...state } }),

  resetEditor: () =>
    set({
      project: null,
      projectId: null,
      projectTitle: "Untitled project",
      projectStatus: "draft",
      loadingProject: false,
      projectError: null,
      clips: [],
      mediaAssets: [],
      playback: { ...initialPlayback },
      selectedClipId: null,
      zoom: 1,
      save: { lastSavedAt: null, saving: false, error: null },
    }),
}))

// Helpers exported for components
export const editorHelpers = {
  serverClipToLocal,
  serverMediaToLocal,
}