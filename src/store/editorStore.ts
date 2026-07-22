import { create } from "zustand";
import type { TimelineClip, PlaybackState, MediaAsset, Effect, Keyframe, ChromaKeySettings, ColorGradeSettings, TextAnimationSettings, TransitionSettings } from "@/types/editor";
import {
  api,
  clipFromServer,
  type ServerClip,
  type Media,
  type Project,
} from "@/lib/api";
import { mediaCache } from "@/lib/mediaCache";

export type ClipType = "video" | "audio" | "image" | "text" | "sticker";

export type { Effect, Keyframe, ChromaKeySettings, ColorGradeSettings, TextAnimationSettings, TransitionSettings } from "@/types/editor";

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
  metadata?: Record<string, unknown>;
  transforms?: { x: number; y: number; scale: number; rotation: number; opacity: number };
  effects: Effect[];
  speed?: number;
  keyframes?: Keyframe[];
  chromaKey?: ChromaKeySettings;
  colorGrade?: ColorGradeSettings;
  textAnimation?: TextAnimationSettings;
  transition?: TransitionSettings;
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

// Undo/redo snapshot — only clips are tracked (the most mutation-heavy state)
interface HistoryEntry {
  clips: LocalClip[];
}

interface EditorState {
  project: Project | null;
  projectId: string | null;
  projectTitle: string;
  projectStatus: string;
  loadingProject: boolean;
  projectError: string | null;

  clips: LocalClip[];
  mediaAssets: LocalMedia[];

  playback: PlaybackState;
  selectedClipId: string | null;
  zoom: number;

  // Aspect ratio for preview canvas
  aspectRatio: "16/9" | "9/16" | "1/1" | "4/3";

  save: SaveState;
  connectionStatus: ConnectionStatus;

  // Undo / redo
  past: HistoryEntry[];
  future: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;

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

  // ─── Effects ───────────────────────────────────────────────────────────
  addEffectToClip: (clipId: string, effect: Effect) => void;
  removeEffectFromClip: (clipId: string, effectId: string) => void;
  updateEffectInClip: (clipId: string, effectId: string, updates: Partial<Effect>) => void;
  setClipEffects: (clipId: string, effects: Effect[]) => void;

  // ─── Media ─────────────────────────────────────────────────────────────
  setMediaAssets: (assets: LocalMedia[]) => void;
  addMediaAssetLocal: (asset: LocalMedia) => void;
  updateMediaAssetLocal: (id: string, updates: Partial<LocalMedia>) => void;
  removeMediaAssetLocal: (id: string) => void;

  // ─── Timeline ──────────────────────────────────────────────────────────
  setZoom: (zoom: number) => void;
  setAspectRatio: (ratio: EditorState["aspectRatio"]) => void;

  // ─── Connection ────────────────────────────────────────────────────────
  setConnectionStatus: (status: ConnectionStatus) => void;

  setSaveState: (state: Partial<SaveState>) => void;
  resetEditor: () => void;

  // ─── History ───────────────────────────────────────────────────────────
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
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
    url: media?.url ?? undefined,
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
    effects: [], // Initialize empty effects array
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
  playback: { ...initialPlayback },
  selectedClipId: null,
  zoom: 1,
  aspectRatio: "16/9",
  save: { lastSavedAt: null, saving: false, error: null },
  connectionStatus: "disconnected",

  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  // ─── History ─────────────────────────────────────────────────────────────
  pushHistory: () => {
    const { clips, past } = get();
    const entry: HistoryEntry = { clips: clips.map((c) => ({ ...c })) };
    set({
      past: [...past.slice(-49), entry],
      future: [],
      canUndo: true,
      canRedo: false,
    });
  },

  undo: () => {
    const { past, clips, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const currentEntry: HistoryEntry = { clips: clips.map((c) => ({ ...c })) };
    const duration = prev.clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);
    set({
      clips: prev.clips,
      past: newPast,
      future: [currentEntry, ...future],
      canUndo: newPast.length > 0,
      canRedo: true,
      playback: { ...get().playback, duration },
    });
  },

  redo: () => {
    const { past, clips, future } = get();
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    const currentEntry: HistoryEntry = { clips: clips.map((c) => ({ ...c })) };
    const duration = next.clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);
    set({
      clips: next.clips,
      past: [...past, currentEntry],
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
      playback: { ...get().playback, duration },
    });
  },

  setProject: (project: Project) =>
    set({ project, projectId: project.id, projectTitle: project.title, projectStatus: project.status }),

  setProjectTitle: (title: string) => set({ projectTitle: title }),
  setProjectStatus: (status: string) => set({ projectStatus: status }),

  loadProject: async (projectId: string, token: string) => {
    set({ loadingProject: true, projectError: null, project: null, projectId: null, clips: [], mediaAssets: [] });
    try {
      const project = await api.getProject(token, projectId);
      if (!project?.id) throw new Error("Project not found");

      const [serverClips, serverMedia] = await Promise.all([
        api.getClips(token, projectId).catch(() => [] as ServerClip[]),
        api.getMedia(token, { projectId }).catch(() => [] as Media[]),
      ]);

      const mediaAssets = serverMedia.map(serverMediaToLocal).map((m) => mediaCache.hydrate(m));
      const mediaByServerId = new Map(mediaAssets.map((m) => [m.serverId, m]));
      const clips: LocalClip[] = serverClips.map((sc) => serverClipToLocal(sc, mediaByServerId));
      const duration = clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);

      set({
        project, projectId: project.id, projectTitle: project.title,
        projectStatus: project.status, clips, mediaAssets,
        playback: { ...initialPlayback, duration }, loadingProject: false,
        past: [], future: [], canUndo: false, canRedo: false,
      });
    } catch (err) {
      console.error("Failed to load project", err);
      set({
        loadingProject: false, project: null, projectId: null,
        projectError: err instanceof Error ? err.message : "Failed to load project",
      });
    }
  },

  createProject: async (title: string, token: string) => {
    const project = await api.createProject(token, { title });
    set({
      project, projectId: project.id, projectTitle: project.title,
      projectStatus: project.status, clips: [], mediaAssets: [],
      playback: { ...initialPlayback },
      past: [], future: [], canUndo: false, canRedo: false,
    });
    return project;
  },

  renameProject: async (title: string, token: string) => {
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

  seek: (time: number) => {
    const { playback } = get();
    const clamped = Math.max(0, Math.min(playback.duration || time, time));
    set({ playback: { ...playback, currentTime: clamped, isPlaying: false } });
  },
  setCurrentTime: (time: number) => set((s) => ({ playback: { ...s.playback, currentTime: Math.max(0, time) } })),
  setDuration: (duration: number) => set((s) => ({ playback: { ...s.playback, duration: Math.max(0, duration) } })),
  setVolume: (volume: number) => set((s) => ({ playback: { ...s.playback, volume: Math.max(0, Math.min(1, volume)) } })),
  setPlaybackRate: (rate: number) => set((s) => ({ playback: { ...s.playback, playbackRate: rate } })),

  setClips: (clips: LocalClip[]) => set({ clips }),

  addClipLocal: (clip: LocalClip) =>
    set((s) => {
      // Ensure every clip has an effects array
      const clipWithEffects = { ...clip, effects: clip.effects || [] };
      const newClips = [...s.clips, clipWithEffects];
      const duration = Math.max(s.playback.duration, clip.startTime + clip.duration);
      return { clips: newClips, playback: { ...s.playback, duration } };
    }),

  updateClipLocal: (id: string, updates: Partial<LocalClip>) =>
    set((s) => {
      const clips = s.clips.map((c) => c.id === id ? { ...c, ...updates, dirty: true } : c);
      const duration = clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), s.playback.duration);
      return { clips, playback: { ...s.playback, duration } };
    }),

  deleteClipLocal: (id: string) =>
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
    })),

  selectClip: (id) => set({ selectedClipId: id }),

  splitClip: async (id: string, atTime: number, token: string) => {
    const { clips, projectId } = get();
    const clip = clips.find((c) => c.id === id);
    if (!clip || !projectId) return;

    const splitOffset = atTime - clip.startTime;
    if (splitOffset <= 0.1 || splitOffset >= clip.duration - 0.1) return;

    get().pushHistory();

    const leftDuration = splitOffset;
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

    get().updateClipLocal(id, { duration: leftDuration, trimEnd: (clip.trimStart ?? 0) + leftDuration });
    get().addClipLocal(rightClip);

    if (token) {
      await Promise.all([
        get().syncUpdateClip(id, { duration: leftDuration, trimEnd: (clip.trimStart ?? 0) + leftDuration }, token),
        get().syncAddClip(rightClip, token),
      ]);
    }
  },

  syncAddClip: async (clip: LocalClip, token: string) => {
    const { projectId } = get();
    if (!projectId) return null;
    set({ save: { ...get().save, saving: true, error: null } });
    try {
      const metadata: Record<string, unknown> = { ...(clip.metadata ?? {}) };
      if (clip.type === "text" && clip.metadata) {
        Object.assign(metadata, clip.metadata);
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

  syncUpdateClip: async (id: string, updates: Partial<LocalClip>, token: string) => {
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
      const metadata: Record<string, unknown> = { ...(merged.metadata ?? {}) };
      if (merged.type === "text" && merged.metadata) {
        Object.assign(metadata, merged.metadata);
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

  syncDeleteClip: async (id: string, token: string) => {
    const { projectId, clips } = get();
    const clip = clips.find((c) => c.id === id);
    if (!projectId) return;
    get().pushHistory();
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

  // Effect implementations
  addEffectToClip: (clipId: string, effect: Effect) => {
    set((state) => ({
      clips: state.clips.map((clip) => 
        clip.id === clipId 
          ? { ...clip, effects: [...clip.effects, effect] }
          : clip
      )
    }));
  },
  removeEffectFromClip: (clipId: string, effectId: string) => {
    set((state) => ({
      clips: state.clips.map((clip) => 
        clip.id === clipId 
          ? { ...clip, effects: clip.effects.filter((e) => e.id !== effectId) }
          : clip
      )
    }));
  },
  updateEffectInClip: (clipId: string, effectId: string, updates: Partial<Effect>) => {
    set((state) => ({
      clips: state.clips.map((clip) => 
        clip.id === clipId 
          ? { 
              ...clip, 
              effects: clip.effects.map((e) => 
                e.id === effectId ? { ...e, ...updates } : e
              ) 
            }
          : clip
      )
    }));
  },
  setClipEffects: (clipId: string, effects: Effect[]) => {
    set((state) => ({
      clips: state.clips.map((clip) => 
        clip.id === clipId 
          ? { ...clip, effects }
          : clip
      )
    }));
  },

  setMediaAssets: (assets: LocalMedia[]) => set({ mediaAssets: assets }),
  addMediaAssetLocal: (asset: LocalMedia) => set((s) => ({ mediaAssets: [...s.mediaAssets, asset] })),
  updateMediaAssetLocal: (id: string, updates: Partial<LocalMedia>) =>
    set((s) => ({ mediaAssets: s.mediaAssets.map((a) => a.id === id ? { ...a, ...updates } : a) })),
  removeMediaAssetLocal: (id: string) =>
    set((s) => ({ mediaAssets: s.mediaAssets.filter((a) => a.id !== id) })),

  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setSaveState: (state) => set({ save: { ...get().save, ...state } }),

  resetEditor: () =>
    set({
      project: null, projectId: null, projectTitle: "Untitled project",
      projectStatus: "draft", loadingProject: false, projectError: null,
      clips: [], mediaAssets: [], playback: { ...initialPlayback },
      selectedClipId: null, zoom: 1, aspectRatio: "16/9",
      save: { lastSavedAt: null, saving: false, error: null },
      connectionStatus: "disconnected",
      past: [], future: [], canUndo: false, canRedo: false,
    }),
}));

export const editorHelpers = { serverClipToLocal, serverMediaToLocal };