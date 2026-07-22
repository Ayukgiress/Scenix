import { create } from "zustand"
import type { Project, Activity, Stats, ProjectStatus } from "@/types/dashboard"
import type { Media, Export } from "@/lib/api"
import { api } from "@/lib/api"
import type { Project as ApiProject } from "@/lib/api"

const STORAGE_QUOTA_GB = 50 // default free-plan quota

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
  createProjectAndReturn: (token: string, title: string) => Promise<ApiProject | null>
  deleteProject: (token: string, id: string) => Promise<void>
  addActivity: (activity: Omit<Activity, "id" | "timestamp">) => void
  updateProjectProgress: (id: string, progress: number) => void
  updateProjectStatus: (id: string, status: ProjectStatus) => void
  incrementStat: (key: keyof Omit<Stats, "storageUsed" | "storageTotal" | "storageVideoGB" | "storageAudioGB">) => void
  setError: (error: string | null) => void
}

function timeAgo(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHrs / 24)

  if (diffHrs < 1) return "Just now"
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays === 1) return "Yesterday"
  return `${diffDays} days ago`
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  projects: [],
  activities: [],
  stats: {
    totalProjects: 0,
    storageUsed: 0,
    storageTotal: STORAGE_QUOTA_GB,
    storageVideoGB: 0,
    storageAudioGB: 0,
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
        duration: "0:00",
        size: "0 MB",
        status: (p.status as ProjectStatus) ?? "DRAFT",
        hue: 60 + (i * 70) % 300,
        updatedAt: timeAgo(p.updatedAt),
        thumb: [60 + (i * 70) % 300, 40 + (i * 50) % 280, p.thumbnailUrl ?? undefined],
      }))

      set({
        projects,
        stats: {
          ...get().stats,
          totalProjects: projects.length,
        },
      })
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch projects",
      })
    } finally {
      set({ loading: false })
    }
  },

  fetchMedia: async (token: string) => {
    try {
      const media = await api.getMedia(token)
      const totalSize = media.reduce((sum, m) => sum + (m.size || 0), 0)
      const storageUsedGB = Math.round((totalSize / (1024 * 1024 * 1024)) * 100) / 100

      // Compute real video vs audio breakdown
      const videoBytes = media
        .filter((m) => m.type === "video" || m.type === "image")
        .reduce((s, m) => s + (m.size || 0), 0)
      const audioBytes = media
        .filter((m) => m.type === "audio")
        .reduce((s, m) => s + (m.size || 0), 0)

      set({
        media,
        stats: {
          ...get().stats,
          storageUsed: storageUsedGB,
          storageTotal: STORAGE_QUOTA_GB,
          storageVideoGB: Math.round((videoBytes / (1024 * 1024 * 1024)) * 100) / 100,
          storageAudioGB: Math.round((audioBytes / (1024 * 1024 * 1024)) * 100) / 100,
        },
      })
    } catch (error) {
      console.error("Failed to fetch media:", error)
      set({ media: [] })
    }
  },

  fetchExports: async (token: string) => {
    try {
      const exportsResp = await api.getExports(token)
      const exportActivities: Activity[] = exportsResp.slice(0, 10).map((e) => ({
        id: e.id,
        icon: "export",
        text: `Export ${e.status.toLowerCase()} — ${e.format.toUpperCase()} ${e.quality}`,
        time: timeAgo(e.createdAt),
        timestamp: new Date(e.createdAt).getTime(),
      }))

      // Merge with existing project activities, sort by timestamp desc
      const existing = get().activities.filter((a) => a.icon !== "export")
      const merged = [...exportActivities, ...existing]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10)

      set({
        exports: exportsResp,
        activities: merged,
        stats: {
          ...get().stats,
          exports: exportsResp.length,
        },
      })
    } catch (error) {
      console.error("Failed to fetch exports:", error)
      set({ exports: [] })
    }
  },

  createProject: async (token: string, title: string) => {
    try {
      set({ loading: true, error: null })
      await api.createProject(token, { title })
      await get().fetchProjects(token)
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to create project",
      })
    } finally {
      set({ loading: false })
    }
  },

  createProjectAndReturn: async (token: string, title: string) => {
    try {
      set({ loading: true, error: null })
      const created: ApiProject = await api.createProject(token, { title })
      await get().fetchProjects(token)
      return created
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to create project",
      })
      return null
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
      set({
        error:
          error instanceof Error ? error.message : "Failed to delete project",
      })
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
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, progress } : p,
      ),
    })),

  updateProjectStatus: (id, status) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, status, progress: undefined } : p,
      ),
    })),

  incrementStat: (key) =>
    set((state) => ({
      stats: { ...state.stats, [key]: state.stats[key] + 1 },
    })),

  setError: (error) => set({ error }),
}))
