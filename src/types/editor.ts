export interface Keyframe {
  time: number // relative to clip start (seconds)
  property: string
  value: number
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out"
}

export type BlendMode =
  | "normal"
  | "screen"
  | "multiply"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity"

export type ClipMaskShape = "rect" | "circle" | "freeform"

export interface ClipMaskPoint {
  x: number
  y: number
  cp1x?: number
  cp1y?: number
  cp2x?: number
  cp2y?: number
}

export interface ClipMask {
  enabled: boolean
  shape: ClipMaskShape
  x?: number // center offset in clip-local % space
  y?: number // center offset in clip-local % space
  width?: number // rect width in clip-local % space
  height?: number // rect height in clip-local % space
  radius?: number // circle radius in clip-local % space
  scale?: number // mask scale multiplier
  rotation?: number // mask rotation degrees
  points?: ClipMaskPoint[] // freeform polygon / bezier path anchors
  feather?: number
}

export interface TimelineClip {
  id: string
  type: "video" | "audio" | "image" | "text" | "sticker" | "shape"
  file?: File
  url?: string
  startTime: number
  duration: number
  track: number
  trimStart: number
  trimEnd: number
  volume?: number
  pan?: number   // -1 (full left) to 1 (full right), default 0
  muted?: boolean
  speed?: number // 0.1 – 4.0, default 1
  effects?: Effect[]
  transforms?: Transform
  keyframes?: Keyframe[]
  chromaKey?: ChromaKeySettings
  colorGrade?: ColorGradeSettings
  textAnimation?: TextAnimationSettings
  transition?: TransitionSettings
  colorSpace?: ColorSpace; // Source color space of the media
  blendMode?: BlendMode; // Blend mode for compositing
  mask?: ClipMask
}

export interface ChromaKeySettings {
  enabled: boolean
  color: string // hex
  tolerance: number // 0–1
  smoothing: number // 0–1
}

/** A single control point on a tone curve: [input 0–1, output 0–1] */
export type CurvePoint = [number, number]

/** Per-channel tone curves. Each channel has an ordered list of control points. */
export interface ToneCurves {
  luma: CurvePoint[]  // master luminance
  r:    CurvePoint[]
  g:    CurvePoint[]
  b:    CurvePoint[]
}

/** HSL qualifier that isolates a color range for secondary correction. */
export interface SecondaryQualifier {
  hueCenter:  number  // 0–360
  hueWidth:   number  // 0–180
  satMin:     number  // 0–1
  satMax:     number  // 0–1
  lumMin:     number  // 0–1
  lumMax:     number  // 0–1
}

/** Adjustments applied only within the qualified region. */
export interface SecondaryCorrection {
  enabled:   boolean
  qualifier: SecondaryQualifier
  hue:        number  // -180 to 180
  saturation: number  // -1 to 1
  brightness: number  // -1 to 1
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
  curves?: ToneCurves
  secondary?: SecondaryCorrection
}

export interface TextAnimationSettings {
  type: "none" | "fade-in" | "typewriter" | "slide-up" | "slide-down" | "bounce" | "zoom-in" | "glitch"
  duration: number
  delay: number
}

/** Supported source color spaces for media assets */
export type ColorSpace =
  | "srgb"        // Standard sRGB (default)
  | "rec709"      // HD video standard
  | "rec2020"     // UHD/HDR video standard
  | "p3"          // DCI-P3 (cinema/display)
  | "linear"      // Linear gamma (raw/exported footage)
  | "log-c"       // Canon C-Log
  | "s-log3"      // Sony S-Log3
  | "v-log"       // Panasonic V-Log

export interface LutSettings {
  enabled: boolean
  /** Public URL of the .cube file (stored in cloud storage) */
  url: string
  /** Display name shown in the UI */
  name: string
  intensity: number  // 0–1
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
  playbackRate: number  // negative = reverse
  frameRate: number     // project fps, default 30
  inPoint:  number | null
  outPoint: number | null
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
  colorSpace?: ColorSpace // Source color space of the media
}