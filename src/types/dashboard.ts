// Backend ProjectStatus enum: DRAFT | IN_PROGRESS | EXPORTED | PUBLISHED | ARCHIVED
// We map these to display-friendly keys used by the dashboard UI.
export type ProjectStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "EXPORTED"
  | "PUBLISHED"
  | "ARCHIVED"

export interface Project {
  id: string
  title: string
  duration: string
  size: string
  status: ProjectStatus | string
  progress?: number
  hue: number
  updatedAt: string
  thumb: [number, number, string?]  // [hue1, hue2, optional video/thumbnail url]
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
  storageVideoGB: number
  storageAudioGB: number
  exports: number
  aiGenerations: number
}
