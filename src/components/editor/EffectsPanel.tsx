import { useState } from "react"
import { useEditorStore } from "@/store/editorStore"
import type { LocalClip, Effect } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import { Film, Music, Layers, Sparkles, Zap, Image } from "lucide-react"

// Comprehensive effect categories for professional-grade editing
const VIDEO_FILTERS = [
  { name: "None", style: "", description: "Reset to original" },
  { name: "Vivid", style: "saturate(1.8) contrast(1.1)", description: "Enhanced colors" },
  { name: "Matte", style: "contrast(0.9) brightness(1.05) saturate(0.8)", description: "Soft, muted look" },
  { name: "B&W", style: "grayscale(1)", description: "Classic black and white" },
  { name: "Warm", style: "sepia(0.4) saturate(1.3)", description: "Golden vintage feel" },
  { name: "Cool", style: "hue-rotate(30deg) saturate(1.2)", description: "Blue-toned cinematic" },
  { name: "Fade", style: "opacity(0.85) brightness(1.1) contrast(0.9)", description: "Dreamy fade" },
  { name: "Cinematic", style: "contrast(1.2) saturate(0.9) brightness(0.95)", description: "Hollywood style" },
  { name: "Vintage", style: "sepia(0.2) contrast(1.1) saturate(0.8)", description: "Old film look" },
  { name: "Drama", style: "contrast(1.4) saturate(0.7) brightness(0.9)", description: "High contrast mood" },
  { name: "Neon", style: "hue-rotate(180deg) saturate(1.5) brightness(1.1)", description: "Vibrant neon colors" },
  { name: "Noir", style: "grayscale(1) contrast(1.3) brightness(0.85)", description: "Film noir aesthetic" },
]

const VIDEO_TRANSITIONS = [
  { name: "Fade In", type: "fade-in", duration: 1.5, description: "Smooth fade from black" },
  { name: "Fade Out", type: "fade-out", duration: 1.5, description: "Smooth fade to black" },
  { name: "Crossfade", type: "crossfade", duration: 1.0, description: "Blend between clips" },
  { name: "Dissolve", type: "dissolve", duration: 1.2, description: "Classic dissolve effect" },
  { name: "Wipe Right", type: "wipe-right", duration: 0.8, description: "Slide in from left" },
  { name: "Wipe Left", type: "wipe-left", duration: 0.8, description: "Slide in from right" },
  { name: "Zoom In", type: "zoom-in", duration: 1.0, description: "Begin with zoom effect" },
  { name: "Zoom Out", type: "zoom-out", duration: 1.0, description: "End with zoom effect" },
]

const AUDIO_EFFECTS = [
  { name: "Fade In", type: "audio-fade-in", duration: 2.0, description: "Gradual volume increase" },
  { name: "Fade Out", type: "audio-fade-out", duration: 2.0, description: "Gradual volume decrease" },
  { name: "Normalize", type: "audio-normalize", duration: 0, description: "Auto-adjust volume" },
  { name: "Echo", type: "audio-echo", duration: 0, description: "Add echo/reverb effect" },
  { name: "Bass Boost", type: "audio-bass", duration: 0, description: "Enhance low frequencies" },
]

const VISUAL_EFFECTS = [
  { name: "Blur", type: "blur", style: "blur(5px)", description: "Gaussian blur effect" },
  { name: "Sharpen", type: "sharpen", style: "unsharp-mask(0.5)", description: "Enhance details" },
  { name: "Pixelate", type: "pixelate", style: "pixelate(8px)", description: "8-bit pixel effect" },
  { name: "Vignette", type: "vignette", style: "", description: "Darken edges for focus" },
  { name: "Glitch", type: "glitch", style: "", description: "Digital distortion effect" },
  { name: "Chromatic", type: "chromatic-aberration", style: "", description: "RGB split effect" },
]

const STICKERS = [
  { emoji: "🔥", label: "Fire", category: "Emojis" },
  { emoji: "⭐", label: "Star", category: "Emojis" },
  { emoji: "💥", label: "Boom", category: "Emojis" },
  { emoji: "❤️", label: "Heart", category: "Emojis" },
  { emoji: "😂", label: "LOL", category: "Emojis" },
  { emoji: "🎵", label: "Music", category: "Emojis" },
  { emoji: "✨", label: "Sparkle", category: "Emojis" },
  { emoji: "🎉", label: "Party", category: "Emojis" },
  { emoji: "👑", label: "Crown", category: "Emojis" },
  { emoji: "🌈", label: "Rainbow", category: "Emojis" },
  { emoji: "💯", label: "100", category: "Emojis" },
  { emoji: "🚀", label: "Rocket", category: "Emojis" },
]

type TabType = "filters" | "transitions" | "visual" | "audio" | "stickers"

export function EffectsPanel() {
  const [activeTab, setActiveTab] = useState<TabType>("filters")
  const clips = useEditorStore((s) => s.clips)
  const selectedClipId = useEditorStore((s) => s.selectedClipId)
  const addClipLocal = useEditorStore((s) => s.addClipLocal)
  const addEffectToClip = useEditorStore((s) => s.addEffectToClip)
  const removeEffectFromClip = useEditorStore((s) => s.removeEffectFromClip)
  const syncAddClip = useEditorStore((s) => s.syncAddClip)
  const updateClipLocal = useEditorStore((s) => s.updateClipLocal)
  const currentTime = useEditorStore((s) => s.playback.currentTime)
  const { accessToken } = useAuth()

  // Get selected clip if any
  const selectedClip = clips.find(c => c.id === selectedClipId)

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "filters", label: "Filters", icon: <Image className="size-3" /> },
    { id: "visual", label: "Visual FX", icon: <Sparkles className="size-3" /> },
    { id: "transitions", label: "Transitions", icon: <Zap className="size-3" /> },
    { id: "audio", label: "Audio", icon: <Music className="size-3" /> },
    { id: "stickers", label: "Stickers", icon: <Layers className="size-3" /> },
  ]

  const addSticker = (emoji: string, label: string) => {
    const clip: LocalClip = {
      id: `tmp_sticker_${crypto.randomUUID()}`,
      mediaId: "",
      type: "sticker",
      startTime: currentTime,
      duration: 3,
      track: 2,
      trimStart: 0,
      trimEnd: 3,
      metadata: { text: emoji, label },
      transforms: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
      effects: [],
    }
    addClipLocal(clip)
    if (accessToken) syncAddClip(clip, accessToken)
  }

  const applyFilterToClip = (filterStyle: string) => {
    if (!selectedClip) return
    
    // Update clip's metadata filter
    updateClipLocal(selectedClip.id, {
      metadata: { ...selectedClip.metadata, filter: filterStyle }
    })
  }

  const addEffectToSelectedClip = (effectType: Effect["type"], effectName: string, params: Record<string, unknown> = {}) => {
    if (!selectedClip) return

    const newEffect: Effect = {
      id: crypto.randomUUID(),
      type: effectType,
      name: effectName,
      params,
    }

    addEffectToClip(selectedClip.id, newEffect)
  }

  const getCurrentClipFilter = () => {
    return (selectedClip?.metadata?.filter as string) || ""
  }

  const renderFilters = () => (
    <div className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Color Grading</p>
      <div className="grid grid-cols-3 gap-2">
        {VIDEO_FILTERS.map((f) => (
              <button
                key={f.name}
                onClick={() => applyFilterToClip(f.style)}
                title={f.description}
                disabled={!selectedClip}
                className={`flex flex-col items-center gap-1 rounded-lg border bg-card p-2 text-center transition-all hover:border-primary/50 ${
                  getCurrentClipFilter() === f.style
                    ? "border-primary/80 ring-1 ring-primary/40"
                    : "border-border/60"
                } ${!selectedClip ? "opacity-50 cursor-not-allowed" : ""}`}
              >
            <div
              className="size-12 rounded-md bg-gradient-to-br from-violet-500 to-pink-500"
              style={{ filter: f.style }}
            />
            <span className="text-[9px] text-foreground font-medium">{f.name}</span>
            <span className="text-[7px] text-muted-foreground leading-tight">{f.description}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const renderVisualEffects = () => (
    <div className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Special Effects</p>
      <div className="grid grid-cols-2 gap-2">
        {VISUAL_EFFECTS.map((fx) => (
          <button
            key={fx.name}
            onClick={() => addEffectToSelectedClip("filter", fx.name, { style: fx.style })}
            title={fx.description}
            disabled={!selectedClip}
            className={`flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center transition-all hover:border-primary/50 ${!selectedClip ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Film className="size-6 text-primary mb-1" />
            <span className="text-[10px] font-medium">{fx.name}</span>
            <span className="text-[7px] text-muted-foreground">{fx.description}</span>
          </button>
        ))}
      </div>
      {selectedClip && selectedClip.effects.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/60">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Active Effects</p>
          <div className="space-y-2">
            {selectedClip.effects.map((effect) => (
              <div key={effect.id} className="flex items-center justify-between bg-card/50 rounded-md p-2">
                <div>
                  <span className="text-[10px] font-medium">{effect.name}</span>
                  <p className="text-[8px] text-muted-foreground">{effect.type}</p>
                </div>
                <button
                  onClick={() => removeEffectFromClip(selectedClip.id, effect.id)}
                  className="text-[8px] text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderTransitions = () => (
    <div className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Clip Transitions</p>
      <div className="grid grid-cols-2 gap-2">
        {VIDEO_TRANSITIONS.map((t) => (
          <button
            key={t.name}
            onClick={() => addEffectToSelectedClip("transition", t.name)}
            title={t.description}
            disabled={!selectedClip}
            className={`flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center transition-all hover:border-primary/50 ${!selectedClip ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Zap className="size-6 text-primary mb-1" />
            <span className="text-[10px] font-medium">{t.name}</span>
            <span className="text-[7px] text-muted-foreground">{t.duration}s</span>
          </button>
        ))}
      </div>
    </div>
  )

  const renderAudioEffects = () => (
    <div className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Audio Processing</p>
      <div className="grid grid-cols-2 gap-2">
        {AUDIO_EFFECTS.map((a) => (
          <button
            key={a.name}
            onClick={() => addEffectToSelectedClip("overlay", a.name)}
            title={a.description}
            disabled={!selectedClip || (selectedClip.type !== "audio" && selectedClip.type !== "video")}
            className={`flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center transition-all hover:border-primary/50 ${(!selectedClip || (selectedClip.type !== "audio" && selectedClip.type !== "video")) ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Music className="size-6 text-primary mb-1" />
            <span className="text-[10px] font-medium">{a.name}</span>
            <span className="text-[7px] text-muted-foreground">{a.description}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const renderStickers = () => (
    <div className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Stickers & Overlays</p>
      <div className="grid grid-cols-4 gap-2">
        {STICKERS.map((s) => (
          <button
            key={s.label}
            onClick={() => addSticker(s.emoji, s.label)}
            title={`Add ${s.label} sticker`}
            className="flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-card p-2 transition-all hover:border-primary/50 hover:bg-card/80"
          >
            <span className="text-3xl">{s.emoji}</span>
            <span className="text-[8px] text-muted-foreground">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case "filters": return renderFilters()
      case "visual": return renderVisualEffects()
      case "transitions": return renderTransitions()
      case "audio": return renderAudioEffects()
      case "stickers": return renderStickers()
      default: return renderFilters()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Professional Effects Suite
        </span>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-border/60 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-[9px] font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!selectedClip && activeTab !== "stickers" && (
          <div className="mb-4 rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
            <p className="text-[10px] text-amber-200">Select a clip on the timeline to apply effects</p>
          </div>
        )}
        {renderContent()}
      </div>
    </div>
  )
}