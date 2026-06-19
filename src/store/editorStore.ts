import { create } from "zustand"
import type { TimelineClip, PlaybackState, MediaAsset } from "@/types/editor"

interface EditorState {
  clips: TimelineClip[]
  mediaAssets: MediaAsset[]
  playback: PlaybackState
  selectedClipId: string | null
  zoom: number
  
  // Playback controls
  play: () => void
  pause: () => void
  seek: (time: number) => void
  setCurrentTime: (time: number) => void
  
  // Clip operations
  addClip: (clip: Omit<TimelineClip, "id">) => void
  updateClip: (id: string, updates: Partial<TimelineClip>) => void
  deleteClip: (id: string) => void
  selectClip: (id: string | null) => void
  
  // Media operations
  addMediaAsset: (asset: Omit<MediaAsset, "id">) => void
  removeMediaAsset: (id: string) => void
  
  // Timeline operations
  setZoom: (zoom: number) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  clips: [],
  mediaAssets: [],
  playback: {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    playbackRate: 1,
  },
  selectedClipId: null,
  zoom: 1,

  play: () => set((state) => ({ 
    playback: { ...state.playback, isPlaying: true } 
  })),

  pause: () => set((state) => ({ 
    playback: { ...state.playback, isPlaying: false } 
  })),

  seek: (time: number) => set((state) => ({ 
    playback: { ...state.playback, currentTime: time, isPlaying: false } 
  })),

  setCurrentTime: (time: number) => set((state) => ({ 
    playback: { ...state.playback, currentTime: time } 
  })),

  addClip: (clip) => {
    const id = Date.now().toString() + Math.random()
    set((state) => ({
      clips: [...state.clips, { ...clip, id }],
      playback: {
        ...state.playback,
        duration: Math.max(
          state.playback.duration,
          clip.startTime + clip.duration
        ),
      },
    }))
  },

  updateClip: (id, updates) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  deleteClip: (id) =>
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== id),
      selectedClipId: state.selectedClipId === id ? null : state.selectedClipId,
    })),

  selectClip: (id) => set({ selectedClipId: id }),

  addMediaAsset: (asset) => {
    const id = Date.now().toString() + Math.random()
    set((state) => ({
      mediaAssets: [...state.mediaAssets, { ...asset, id }],
    }))
  },

  removeMediaAsset: (id) =>
    set((state) => ({
      mediaAssets: state.mediaAssets.filter((a) => a.id !== id),
    })),

  setZoom: (zoom) => set({ zoom }),
}))
