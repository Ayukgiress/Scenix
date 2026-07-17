import { useEditorStore } from "@/store/editorStore"
import type { LocalClip } from "@/store/editorStore"

const STICKERS = [
  { emoji: "🔥", label: "Fire" },
  { emoji: "⭐", label: "Star" },
  { emoji: "💥", label: "Boom" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "😂", label: "LOL" },
  { emoji: "🎵", label: "Music" },
  { emoji: "✨", label: "Sparkle" },
  { emoji: "🎉", label: "Party" },
  { emoji: "👑", label: "Crown" },
  { emoji: "🌈", label: "Rainbow" },
  { emoji: "💯", label: "100" },
  { emoji: "🚀", label: "Rocket" },
]

const FILTERS = [
  { name: "Vivid", style: "saturate(1.8) contrast(1.1)" },
  { name: "Matte", style: "contrast(0.9) brightness(1.05) saturate(0.8)" },
  { name: "B&W", style: "grayscale(1)" },
  { name: "Warm", style: "sepia(0.4) saturate(1.3)" },
  { name: "Cool", style: "hue-rotate(30deg) saturate(1.2)" },
  { name: "Fade", style: "opacity(0.85) brightness(1.1) contrast(0.9)" },
]

export function EffectsPanel() {
  const effects = useEditorStore((s) => s.effects)
  const setEffects = useEditorStore((s) => s.setEffects)
  const addClipLocal = useEditorStore((s) => s.addClipLocal)
  const currentTime = useEditorStore((s) => s.playback.currentTime)

  const addSticker = (emoji: string, label: string) => {
    const clip: LocalClip = {
      id: `tmp_sticker_${Date.now()}`,
      mediaId: "",
      type: "sticker",
      startTime: currentTime,
      duration: 3,
      track: 2,
      trimStart: 0,
      trimEnd: 3,
      metadata: { text: emoji, label },
      transforms: { x: 100, y: 100, scale: 1, rotation: 0, opacity: 1 },
    }
    addClipLocal(clip)
  }

  const toggleEffect = (effect: string) => {
    const newEffects = effects.includes(effect)
      ? effects.filter((e) => e !== effect)
      : [...effects, effect]
    setEffects(newEffects)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Effects & Stickers
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Filters
        </p>
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.name}
              onClick={() => toggleEffect(f.style)}
              title={f.name}
              className={`flex flex-col items-center gap-1 rounded-lg border bg-card p-2 text-center transition-all hover:border-primary/50 ${
                effects.includes(f.style)
                  ? "border-primary/80"
                  : "border-border/60"
              }`}
            >
              <div
                className="size-10 rounded-md bg-gradient-to-br from-violet-500 to-pink-500"
                style={{ filter: f.style }}
              />
              <span className="text-[9px] text-muted-foreground">{f.name}</span>
            </button>
          ))}
        </div>

        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Stickers
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {STICKERS.map((s) => (
            <button
              key={s.label}
              onClick={() => addSticker(s.emoji, s.label)}
              title={`Add ${s.label} sticker`}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-border/60 bg-card p-2 transition-all hover:border-primary/50 hover:bg-card/80"
            >
              <span className="text-2xl">{s.emoji}</span>
              <span className="text-[8px] text-muted-foreground">{s.label}</span>
            </button>
          ))}
        </div>


      </div>
    </div>
  )
}