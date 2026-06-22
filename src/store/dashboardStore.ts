import { create } from "zustand"
import type { Project, Activity, Stats } from "@/types/dashboard"
import type { Media, Export } from "@/lib/api"
import { api } from "@/lib/api"

interface DashboardState {
  projects: Project[]
  activities: Activity[]
  stats: Stats
  media: Media[]
  exports: Export[]
  loading: boolean
  error: string | null
  
  // Actions
  fetchProjects: (token: string) => Promise<void>
  fetchMedia: (token: string) => Promise<void>
  fetchExports: (token: string) => Promise<void>
  createProject: (token: string, title: string) => Promise<void>
  deleteProject: (token: string, id: string) => Promise<void>
  addActivity: (activity: Omit<Activity, "id" | "timestamp">) => void
  updateProjectProgress: (id: string, progress: number) => void
  updateProjectStatus: (id: string, status: Project["status"]) => void
  incrementStat: (key: keyof Omit<Stats, "storageUsed" | "storageTotal">) => void
  setError: (error: string | null) => void
}

function timeAgo(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHrs / 24)
  
  if (diffHrs < 1) return 'Just now'
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  projects: [],
  activities: [],
  stats: {
    totalProjects: 0,
    storageUsed: 0,
    storageTotal: 50,
    exports: 0,
    aiGenerations: 0,
  },
  media: [],
  exports: [],
  loading: false,
  error: null,

  fetchProjects: async (token: string) => {
    try {
      set({ loading: true, error: null })
      const backendProjects = await api.getProjects(token)
      
      const projects: Project[] = backendProjects.map((p, i) => ({
        id: p.id,
        title: p.title,
        duration: "0:00", // Will be calculated from clips/media
        size: "0 MB", // Will be calculated from media
        status: p.status as Project["status"],
        hue: 60 + (i * 70) % 300,
        updatedAt: timeAgo(p.updatedAt),
        thumb: [60 + (i * 70) % 300, 40 + (i * 50) % 280]
      }))
      
      set({ 
        projects,
        stats: { 
          ...get().stats, 
          totalProjects: projects.length 
        }
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch projects' })
    } finally {
      set({ loading: false })
    }
  },

  fetchMedia: async (token: string) => {
    try {
      const mediaResponse = await api.getMedia(token)
      const media = Array.isArray(mediaResponse) ? mediaResponse : []
      const totalSize = media.reduce((sum, m) => sum + (m.size || 0), 0)
      
      set({ 
        media,
        stats: {
          ...get().stats,
          storageUsed: Math.round(totalSize / (1024 * 1024 * 1024) * 100) / 100
        }
      })
    } catch (error) {
      console.error('Failed to fetch media:', error)
      set({ media: [] }) // Set empty array on error
    }
  },

  fetchExports: async (token: string) => {
    try {
      const exportsResponse = await api.getExports(token)
      const exports = Array.isArray(exportsResponse) ? exportsResponse : []
      set({ 
        exports,
        stats: {
          ...get().stats,
          exports: exports.length
        }
      })
    } catch (error) {
      console.error('Failed to fetch exports:', error)
      set({ exports: [] }) // Set empty array on error
    }
  },

  createProject: async (token: string, title: string) => {
    try {
      set({ loading: true, error: null })
      await api.createProject(token, { title })
      await get().fetchProjects(token)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create project' })
    } finally {
      set({ loading: false })
    }
  },

  deleteProject: async (token: string, id: string) => {
    try {
      set({ loading: true, error: null })
      await api.deleteProject(token, id)
      await get().fetchProjects(token)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete project' })
    } finally {
      set({ loading: false })
    }
  },

  addActivity: (activity) =>
    set((state) => ({
      activities: [
        { ...activity, id: Date.now().toString(), timestamp: Date.now() },
        ...state.activities,
      ].slice(0, 10),
    })),

  updateProjectProgress: (id, progress) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, progress } : p)),
    })),

  updateProjectStatus: (id, status) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, status, progress: undefined } : p)),
    })),

  incrementStat: (key) =>
    set((state) => ({
      stats: { ...state.stats, [key]: state.stats[key] + 1 },
    })),

  setError: (error) => set({ error })
}))
