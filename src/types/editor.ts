export interface TimelineClip {
  id: string
  type: "video" | "audio" | "image" | "text"
  file?: File
  url?: string
  startTime: number
  duration: number
  track: number
  trimStart: number
  trimEnd: number
  volume?: number
  effects?: Effect[]
  transforms?: Transform
}

export interface Effect {
  id: string
  type: "filter" | "transition" | "overlay"
  name: string
  params: Record<string, any>
}

export interface Transform {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
}

export interface PlaybackState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  playbackRate: number
}

export interface MediaAsset {
  id: string
  name: string
  type: "video" | "audio" | "image"
  url: string
  file?: File
  duration?: number
  thumbnail?: string
  waveform?: number[]
}
