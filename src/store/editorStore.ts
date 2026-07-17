import { realtimeService } from "@/services/realtimeService";
import { create } from "zustand";
import type { TimelineClip, PlaybackState, MediaAsset } from "@/types/editor";
import {
  api,
  clipFromServer,
  type ServerClip,
  type Media,
  type Project,
} from "@/lib/api";

export type ClipType = "video" | "audio" | "image" | "text";

export interface LocalClip extends Omit<TimelineClip, "file"> {
  serverId?: string;
  mediaId: string;
  syncing?: boolean;
  dirty?: boolean;
  opacity?: number;
  rotation?: number;
  zIndex?: number;
  x?: number;
  y?: number;
  width?: number | null;
  height?: number | null;
  // Stores text JSON payload or any clip-level metadata
  metadata?: Record<string, unknown>;
  transforms?: { x: number; y: number; scale: number; rotation: number; opacity: number };
}

export interface LocalMedia extends Omit<MediaAsset, "file"> {
  serverId: string;
  uploading?: boolean;
  progress?: number;
  error?: string;
}

export interface SaveState {
  lastSavedAt: number | null;
  saving: boolean;
  error: string | null;
}

export type ConnectionStatus = "connected" | "disconnected" | "connecting" | "error";

interface EditorState {
  project: Project | null;
  projectId: string | null;
  projectTitle: string;
  projectStatus: string;
  loadingProject: boolean;
  projectError: string | null;

  clips: LocalClip[];
  mediaAssets: LocalMedia[];
  effects: string[];

  playback: PlaybackState;
  selectedClipId: string | null;
  zoom: number;

  save: SaveState;
  connectionStatus: ConnectionStatus;

  // ─── Project lifecycle ──────────────────────────────────────────────────
  setProject: (project: Project) => void;
  setProjectTitle: (title: string) => void;
  setProjectStatus: (status: string) => void;
  loadProject: (projectId: string, token: string) => Promise<void>;
  createProject: (title: string, token: string) => Promise<Project>;
  renameProject: (title: string, token: string) => Promise<void>;

  // ─── Playback ──────────────────────────────────────────────────────────
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;

  // ─── Clips ─────────────────────────────────────────────────────────────
  setClips: (clips: LocalClip[]) => void;
  addClipLocal: (clip: LocalClip) => void;
  updateClipLocal: (id: string, updates: Partial<LocalClip>) => void;
  deleteClipLocal: (id: string) => void;
  selectClip: (id: string | null) => void;
  splitClip: (id: string, atTime: number, token: string) => Promise<void>;

  syncAddClip: (clip: LocalClip, token: string) => Promise<LocalClip | null>;
  syncUpdateClip: (id: string, updates: Partial<LocalClip>, token: string) => Promise<void>;
  syncDeleteClip: (id: string, token: string) => Promise<void>;

  // ─── Media ─────────────────────────────────────────────────────────────
  setMediaAssets: (assets: LocalMedia[]) => void;
  addMediaAssetLocal: (asset: LocalMedia) => void;
  updateMediaAssetLocal: (id: string, updates: Partial<LocalMedia>) => void;
  removeMediaAssetLocal: (id: string) => void;

  // ─── Effects ───────────────────────────────────────────────────────────
  setEffects: (effects: string[]) => void;

  // ─── Timeline ──────────────────────────────────────────────────────────
  setZoom: (zoom: number) => void;

  // ─── Connection ────────────────────────────────────────────────────────
  setConnectionStatus: (status: ConnectionStatus) => void;

  setSaveState: (state: Partial<SaveState>) => void;
  resetEditor: () => void;
}

const initialPlayback: PlaybackState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  playbackRate: 1,
};

function localId() {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function serverClipToLocal(
  server: ServerClip,
  mediaByServerId: Map<string, LocalMedia>,
): LocalClip {
  const translated = clipFromServer(server);
  const media = translated.mediaId ? mediaByServerId.get(translated.mediaId) : undefined;
  const metadata = (server.metadata as Record<string, unknown> | null) ?? undefined;
  return {
    id: `srv_${server.id}`,
    serverId: server.id,
    mediaId: translated.mediaId ?? "",
    type: media
      ? media.type === "audio" ? "audio" : media.type === "image" ? "image" : "video"
      : metadata?.text !== undefined ? "text" : "video",
    url: media?.url ?? (metadata?.text !== undefined ? JSON.stringify(metadata) : undefined),
    startTime: translated.startTime,
    duration: translated.duration,
    track: translated.track,
    trimStart: translated.trimStart,
    trimEnd: translated.trimEnd,
    volume: (server.metadata as Record<string, unknown> | null)?.volume as number ?? 1,
    opacity: translated.opacity,
    rotation: translated.rotation,
    zIndex: translated.zIndex,
    x: translated.x,
    y: translated.y,
    width: translated.width,
    height: translated.height,
    metadata: metadata ?? undefined,
  };
}

function serverMediaToLocal(server: Media): LocalMedia {
  return {
    id: `srv_${server.id}`,
    serverId: server.id,
    name: server.filename,
    type: (server.type as LocalMedia["type"]) || "video",
    url: server.url,
    duration: server.duration,
  };
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
  effects: [],
  playback: { ...initialPlayback },
  selectedClipId: null,
  zoom: 1,
  save: { lastSavedAt: null, saving: false, error: null },
  connectionStatus: "disconnected",

  setProject: (project) =>
    set({ project, projectId: project.id, projectTitle: project.title, projectStatus: project.status }),

  setProjectTitle: (title) => set({ projectTitle: title }),
  setProjectStatus: (status) => set({ projectStatus: status }),

  loadProject: async (projectId, token) => {
    set({ loadingProject: true, projectError: null, project: null, projectId: null, clips: [], mediaAssets: [] });
    try {
      const project = await api.getProject(token, projectId);
      if (!project?.id) throw new Error("Project not found");

      const [serverClips, serverMedia] = await Promise.all([
        api.getClips(token, projectId).catch(() => [] as ServerClip[]),
        api.getMedia(token, { projectId }).catch(() => [] as Media[]),
      ]);

      const mediaAssets = serverMedia.map(serverMediaToLocal);
      const mediaByServerId = new Map(mediaAssets.map((m) => [m.serverId, m]));
      const clips: LocalClip[] = serverClips.map((sc) => serverClipToLocal(sc, mediaByServerId));
      const duration = clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);

      set({
        project, projectId: project.id, projectTitle: project.title,
        projectStatus: project.status, clips, mediaAssets,
        playback: { ...initialPlayback, duration }, loadingProject: false,
      });
    } catch (err) {
      console.error("Failed to load project", err);
      set({
        loadingProject: false, project: null, projectId: null,
        projectError: err instanceof Error ? err.message : "Failed to load project",
      });
    }
  },

  createProject: async (title, token) => {
    const project = await api.createProject(token, { title });
    set({
      project, projectId: project.id, projectTitle: project.title,
      projectStatus: project.status, clips: [], mediaAssets: [],
      playback: { ...initialPlayback },
    });
    return project;
  },

  renameProject: async (title, token) => {
    const { projectId, project } = get();
    if (!projectId || !project) return;
    const optimisticTitle = title.trim();
    if (!optimisticTitle) return;
    set({ projectTitle: optimisticTitle, save: { ...get().save, saving: true } });
    try {
      const updated = await api.updateProject(token, projectId, { title: optimisticTitle });
      set({
        project: updated, projectTitle: updated.title, projectStatus: updated.status,
        save: { lastSavedAt: Date.now(), saving: false, error: null },
      });
    } catch (err) {
      console.error("Failed to rename project", err);
      set({
        projectTitle: project.title,
        save: { ...get().save, saving: false, error: err instanceof Error ? err.message : "Failed to rename project" },
      });
      throw err;
    }
  },

  play: () => set((s) => ({ playback: { ...s.playback, isPlaying: true } })),
  pause: () => set((s) => ({ playback: { ...s.playback, isPlaying: false } })),
  togglePlay: () => set((s) => ({ playback: { ...s.playback, isPlaying: !s.playback.isPlaying } })),

  seek: (time) => {
    const { playback } = get();
    const clamped = Math.max(0, Math.min(playback.duration || time, time));
    set({ playback: { ...playback, currentTime: clamped, isPlaying: false } });
  },
  setCurrentTime: (time) => set((s) => ({ playback: { ...s.playback, currentTime: Math.max(0, time) } })),
  setDuration: (duration) => set((s) => ({ playback: { ...s.playback, duration: Math.max(0, duration) } })),
  setVolume: (volume) => set((s) => ({ playback: { ...s.playback, volume: Math.max(0, Math.min(1, volume)) } })),
  setPlaybackRate: (rate) => set((s) => ({ playback: { ...s.playback, playbackRate: rate } })),

  setClips: (clips) => set({ clips }),

  addClipLocal: (clip) =>
    set((s) => {
      const newClips = [...s.clips, clip];
      const duration = Math.max(s.playback.duration, clip.startTime + clip.duration);
      return { clips: newClips, playback: { ...s.playback, duration } };
    }),

  updateClipLocal: (id, updates) =>
    set((s) => {
      const clips = s.clips.map((c) => c.id === id ? { ...c, ...updates, dirty: true } : c);
      const duration = clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), s.playback.duration);
      return { clips, playback: { ...s.playback, duration } };
    }),

  deleteClipLocal: (id) =>
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
    })),

  selectClip: (id) => set({ selectedClipId: id }),

  splitClip: async (id, atTime, token) => {
    const { clips, projectId } = get();
    const clip = clips.find((c) => c.id === id);
    if (!clip || !projectId) return;

    const splitOffset = atTime - clip.startTime;
    if (splitOffset <= 0.1 || splitOffset >= clip.duration - 0.1) return;

    // Left half
    const leftDuration = splitOffset;
    // Right half
    const rightStart = atTime;
    const rightDuration = clip.duration - splitOffset;
    const rightTrimStart = (clip.trimStart ?? 0) + splitOffset;

    const rightClip: LocalClip = {
      ...clip,
      id: localId(),
      serverId: undefined,
      startTime: rightStart,
      duration: rightDuration,
      trimStart: rightTrimStart,
      trimEnd: clip.trimEnd,
      syncing: true,
      dirty: true,
    };

    // Update left half locally
    get().updateClipLocal(id, { duration: leftDuration, trimEnd: (clip.trimStart ?? 0) + leftDuration });
    get().addClipLocal(rightClip);

    // Sync both to server
    if (token) {
      await Promise.all([
        get().syncUpdateClip(id, { duration: leftDuration, trimEnd: (clip.trimStart ?? 0) + leftDuration }, token),
        get().syncAddClip(rightClip, token),
      ]);
    }
  },

  syncAddClip: async (clip, token) => {
    const { projectId } = get();
    if (!projectId) return null;
    set({ save: { ...get().save, saving: true, error: null } });
    try {
      // Build metadata for text/sticker clips and volume
      const metadata: Record<string, unknown> = { ...(clip.metadata ?? {}) };
      if (clip.type === "text" && clip.url) {
        try { Object.assign(metadata, JSON.parse(clip.url)) } catch { /* ignore */ }
      }
      if (clip.volume !== undefined) metadata.volume = clip.volume;
      if (clip.opacity !== undefined) metadata.opacity = clip.opacity;
      if (clip.rotation !== undefined) metadata.rotation = clip.rotation;

      const serverClip = await api.createClip(token, projectId, {
        mediaId: clip.mediaId,
        track: clip.track ?? 0,
        startTime: clip.startTime,
        duration: clip.duration,
        trimStart: clip.trimStart ?? 0,
        trimEnd: clip.trimEnd ?? clip.duration,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
      const updated: LocalClip = {
        ...clip,
        id: `srv_${serverClip.id}`,
        serverId: serverClip.id,
        syncing: false,
        dirty: false,
      };
      set((s) => ({
        clips: s.clips.filter((c) => c.id !== clip.id).filter((c) => c.id !== updated.id).concat(updated),
        save: { lastSavedAt: Date.now(), saving: false, error: null },
      }));
      return updated;
    } catch (err) {
      console.error("Failed to create clip", err);
      set({
        save: { ...get().save, saving: false, error: err instanceof Error ? err.message : "Failed to save clip" },
      });
      set((s) => ({ clips: s.clips.filter((c) => c.id !== clip.id) }));
      return null;
    }
  },

  syncUpdateClip: async (id, updates, token) => {
    const { projectId, clips } = get();
    const clip = clips.find((c) => c.id === id);
    if (!projectId || !clip) return;
    if (!clip.serverId) {
      await get().syncAddClip(clip, token);
      return;
    }
    set((s) => ({
      clips: s.clips.map((c) => c.id === id ? { ...c, syncing: true } : c),
      save: { ...get().save, saving: true, error: null },
    }));
    try {
      const merged = { ...clip, ...updates };

      // Build metadata from merged clip state
      const metadata: Record<string, unknown> = { ...(merged.metadata ?? {}) };
      if (merged.type === "text" && merged.url) {
        try { Object.assign(metadata, JSON.parse(merged.url)) } catch { /* ignore */ }
      }
      if (merged.volume !== undefined) metadata.volume = merged.volume;
      if (merged.opacity !== undefined) metadata.opacity = merged.opacity;
      if (merged.rotation !== undefined) metadata.rotation = merged.rotation;

      const serverClip = await api.updateClip(token, projectId, clip.serverId, {
        mediaId: merged.mediaId,
        track: merged.track,
        startTime: merged.startTime,
        duration: merged.duration,
        trimStart: merged.trimStart,
        trimEnd: merged.trimEnd,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
      const translated = clipFromServer(serverClip);
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === id
            ? {
                ...c, ...updates, syncing: false, dirty: false,
                startTime: translated.startTime, duration: translated.duration,
                track: translated.track, trimStart: translated.trimStart,
                trimEnd: translated.trimEnd, opacity: translated.opacity,
                rotation: translated.rotation, zIndex: translated.zIndex,
              }
            : c,
        ),
        save: { lastSavedAt: Date.now(), saving: false, error: null },
      }));
    } catch (err) {
      console.error("Failed to update clip", err);
      set((s) => ({
        clips: s.clips.map((c) => c.id === id ? { ...c, syncing: false } : c),
        save: { ...get().save, saving: false, error: err instanceof Error ? err.message : "Failed to save clip" },
      }));
    }
  },

  syncDeleteClip: async (id, token) => {
    const { projectId, clips } = get();
    const clip = clips.find((c) => c.id === id);
    if (!projectId) return;
    const previous = clip;
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
    }));
    if (!clip?.serverId) return;
    try {
      await api.deleteClip(token, projectId, clip.serverId);
    } catch (err) {
      console.error("Failed to delete clip", err);
      if (previous) set((s) => ({ clips: [...s.clips, previous] }));
      set({ save: { ...get().save, error: err instanceof Error ? err.message : "Failed to delete clip" } });
    }
  },

  setMediaAssets: (assets) => set({ mediaAssets: assets }),
  addMediaAssetLocal: (asset) => set((s) => ({ mediaAssets: [...s.mediaAssets, asset] })),
  updateMediaAssetLocal: (id, updates) =>
    set((s) => ({ mediaAssets: s.mediaAssets.map((a) => a.id === id ? { ...a, ...updates } : a) })),
  removeMediaAssetLocal: (id) =>
    set((s) => ({ mediaAssets: s.mediaAssets.filter((a) => a.id !== id) })),

  setEffects: (effects) => {
    set({ effects });
    realtimeService.updateEffects(effects);
  },

  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setSaveState: (state) => set({ save: { ...get().save, ...state } }),

  resetEditor: () =>
    set({
      project: null, projectId: null, projectTitle: "Untitled project",
      projectStatus: "draft", loadingProject: false, projectError: null,
      clips: [], mediaAssets: [], effects: [], playback: { ...initialPlayback },
      selectedClipId: null, zoom: 1,
      save: { lastSavedAt: null, saving: false, error: null },
      connectionStatus: "disconnected",
    }),
}));

export const editorHelpers = { serverClipToLocal, serverMediaToLocal };