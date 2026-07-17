import { create } from "zustand"
import type { Project, Activity, Stats, ProjectStatus } from "@/types/dashboard"
import type { Media, Export } from "@/lib/api"
import { api } from "@/lib/api"
import type { Project as ApiProject } from "@/lib/api"

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
  incrementStat: (key: keyof Omit<Stats, "storageUsed" | "storageTotal">) => void
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
    storageTotal: 0,
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

      set({
        media,
        stats: {
          ...get().stats,
          storageUsed: storageUsedGB,
          // Default plan quota: 50 GB — will be overridden when user plan API is available
          storageTotal: Math.max(50, Math.ceil(storageUsedGB * 2)),
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
      const activities = exportsResp.slice(0, 10).map((e) => ({
        id: e.id,
        icon: "export",
        text: `Export ${e.status.toLowerCase()} — ${e.format.toUpperCase()} ${e.quality}`,
        time: new Date(e.createdAt).toLocaleString(),
        timestamp: new Date(e.createdAt).getTime(),
      }))
      set({
        exports: exportsResp,
        activities,
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
