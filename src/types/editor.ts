export interface Keyframe {
  time: number // relative to clip start (seconds)
  property: string
  value: number
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out"
}

export interface TimelineClip {
  id: string
  type: "video" | "audio" | "image" | "text" | "sticker"
  file?: File
  url?: string
  startTime: number
  duration: number
  track: number
  trimStart: number
  trimEnd: number
  volume?: number
  speed?: number // 0.1 – 4.0, default 1
  effects?: Effect[]
  transforms?: Transform
  keyframes?: Keyframe[]
  chromaKey?: ChromaKeySettings
  colorGrade?: ColorGradeSettings
  textAnimation?: TextAnimationSettings
  transition?: TransitionSettings
}

export interface ChromaKeySettings {
  enabled: boolean
  color: string // hex
  tolerance: number // 0–1
  smoothing: number // 0–1
}

export interface ColorGradeSettings {
  brightness: number  // -1 to 1
  contrast: number    // -1 to 1
  saturation: number  // -1 to 1
  hue: number         // -180 to 180
  temperature: number // -100 to 100
  tint: number        // -100 to 100
  highlights: number  // -1 to 1
  shadows: number     // -1 to 1
  vignette: number    // 0 to 1
}

export interface TextAnimationSettings {
  type: "none" | "fade-in" | "typewriter" | "slide-up" | "slide-down" | "bounce" | "zoom-in" | "glitch"
  duration: number
  delay: number
}

export interface TransitionSettings {
  type: "none" | "fade" | "dissolve" | "wipe-right" | "wipe-left" | "zoom-in" | "zoom-out" | "slide-right" | "slide-left"
  duration: number
  position: "in" | "out" | "both"
}

export interface Effect {
  id: string
  type: "filter" | "transition" | "overlay"
  name: string
  params: Record<string, unknown>
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