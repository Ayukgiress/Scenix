export interface Project {
  id: string
  title: string
  duration: string
  size: string
  status: "exported" | "processing" | "rendering" | "draft"
  progress?: number
  hue: number
  updatedAt: string
  thumb: [number, number]
}

export interface Activity {
  id: string
  icon: string
  text: string
  time: string
  timestamp: number
}

export interface Stats {
  totalProjects: number
  storageUsed: number
  storageTotal: number
  exports: number
  aiGenerations: number
}
