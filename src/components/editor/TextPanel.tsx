import { useState } from "react"
import { Type, Sparkles } from "lucide-react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"
import type { TextAnimationSettings } from "@/types/editor"

function localId() {
  return `tmp_${crypto.randomUUID()}`
}

const FONT_FAMILIES = [
  "Inter", "Georgia", "Courier New", "Impact", "Arial Black",
  "Trebuchet MS", "Palatino", "Comic Sans MS",
]

const TEXT_PRESETS: {
  label: string
  fontSize: number
  fontWeight: string
  color: string
  x: number
  y: number
  fontFamily?: string
  animation?: TextAnimationSettings["type"]
  bg?: string
}[] = [
  { label: "Title",        fontSize: 48, fontWeight: "bold",   color: "#ffffff", x: 50, y: 50, animation: "fade-in" },
  { label: "Subtitle",     fontSize: 32, fontWeight: "600",    color: "#e2e8f0", x: 50, y: 60, animation: "slide-up" },
  { label: "Caption",      fontSize: 20, fontWeight: "normal", color: "#cbd5e1", x: 50, y: 85 },
  { label: "Lower Third",  fontSize: 24, fontWeight: "500",    color: "#ffffff", x: 20, y: 80, animation: "slide-up" },
  { label: "Highlight",    fontSize: 28, fontWeight: "bold",   color: "#fbbf24", x: 50, y: 50, animation: "zoom-in" },
  { label: "Neon",         fontSize: 36, fontWeight: "bold",   color: "#34d399", x: 50, y: 50, animation: "fade-in" },
  { label: "Typewriter",   fontSize: 28, fontWeight: "normal", color: "#ffffff", x: 50, y: 50, animation: "typewriter", fontFamily: "Courier New" },
  { label: "Bounce",       fontSize: 40, fontWeight: "bold",   color: "#f472b6", x: 50, y: 40, animation: "bounce" },
  { label: "Glitch",       fontSize: 36, fontWeight: "bold",   color: "#a78bfa", x: 50, y: 50, animation: "glitch" },
  { label: "Cinematic",    fontSize: 52, fontWeight: "bold",   color: "#ffffff", x: 50, y: 50, animation: "fade-in", fontFamily: "Georgia" },
  { label: "Impact",       fontSize: 60, fontWeight: "bold",   color: "#ef4444", x: 50, y: 50, animation: "zoom-in", fontFamily: "Impact" },
  { label: "Minimal",      fontSize: 18, fontWeight: "300",    color: "#94a3b8", x: 50, y: 90 },
]

export function TextPanel() {
  const { accessToken } = useAuth()
  const addClipLocal  = useEditorStore((s) => s.addClipLocal)
  const syncAddClip   = useEditorStore((s) => s.syncAddClip)
  const pushHistory   = useEditorStore((s) => s.pushHistory)
  const clips         = useEditorStore((s) => s.clips)
  const currentTime   = useEditorStore((s) => s.playback.currentTime)
  const selectClip    = useEditorStore((s) => s.selectClip)
  const seek          = useEditorStore((s) => s.seek)

  const [customText, setCustomText] = useState("Your text here")
  const [fontFamily, setFontFamily] = useState("Inter")
  const [tab, setTab] = useState<"presets" | "custom">("presets")

  const addTextClip = async (preset: typeof TEXT_PRESETS[number]) => {
    if (!accessToken) return
    const lastEnd = clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
    const startTime = currentTime > 0 ? currentTime : lastEnd

    pushHistory()

    const localClip: LocalClip = {
      id: localId(),
      mediaId: "",
      type: "text",
      startTime,
      duration: 5,
      track: 2,
      trimStart: 0,
      trimEnd: 5,
      volume: 0,
      effects: [],
      metadata: {
        text: customText || preset.label,
        fontSize: preset.fontSize,
        fontWeight: preset.fontWeight,
        color: preset.color,
        x: preset.x,
        y: preset.y,
        fontFamily: preset.fontFamily ?? fontFamily,
      },
      textAnimation: preset.animation
        ? { type: preset.animation, duration: 0.6, delay: 0 }
        : undefined,
    }
    addClipLocal(localClip)
    await syncAddClip(localClip, accessToken)
    const latest = useEditorStore.getState().clips.find((c) => c.id === localClip.id)
    if (latest) { selectClip(latest.id); seek(latest.startTime) }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Text</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/60">
        {(["presets", "custom"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
              tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "presets" ? "Presets" : "Custom"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* Text input always visible */}
        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Text content
          </label>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Enter your text…"
          />
        </div>

        {tab === "custom" && (
          <div className="mb-3">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Font family
            </label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>
          </div>
        )}

        {tab === "presets" ? (
          <>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Style presets
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {TEXT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => addTextClip(preset)}
                  disabled={!accessToken}
                  className="group flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-card px-2 py-3 text-center transition-all hover:border-primary/50 hover:bg-card/80 disabled:opacity-50"
                >
                  <span
                    style={{
                      fontSize: `${Math.min(preset.fontSize * 0.28, 16)}px`,
                      fontWeight: preset.fontWeight,
                      color: preset.color,
                      fontFamily: preset.fontFamily,
                    }}
                  >
                    {preset.label}
                  </span>
                  {preset.animation && preset.animation !== "none" && (
                    <span className="flex items-center gap-0.5 text-[8px] text-muted-foreground/60">
                      <Sparkles className="size-2" />{preset.animation}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Quick add
            </p>
            {TEXT_PRESETS.slice(0, 4).map((preset) => (
              <button
                key={preset.label}
                onClick={() => addTextClip({ ...preset, fontFamily })}
                disabled={!accessToken}
                className="group flex w-full items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left transition-all hover:border-primary/50 hover:bg-card/80 disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Type className="size-3 text-muted-foreground" />
                  <span
                    style={{
                      fontSize: `${Math.min(preset.fontSize * 0.35, 18)}px`,
                      fontWeight: preset.fontWeight,
                      color: preset.color,
                      fontFamily,
                    }}
                  >
                    {preset.label}
                  </span>
                </div>
                <span className="ml-2 shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  + Add
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
