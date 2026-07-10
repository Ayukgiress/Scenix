import { useState } from "react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"

function localId() {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const TEXT_PRESETS = [
  { label: "Title", fontSize: 48, fontWeight: "bold", color: "#ffffff" },
  { label: "Subtitle", fontSize: 32, fontWeight: "600", color: "#e2e8f0" },
  { label: "Caption", fontSize: 20, fontWeight: "normal", color: "#cbd5e1" },
  { label: "Lower Third", fontSize: 24, fontWeight: "500", color: "#ffffff" },
  { label: "Highlight", fontSize: 28, fontWeight: "bold", color: "#fbbf24" },
  { label: "Neon", fontSize: 36, fontWeight: "bold", color: "#34d399" },
]

export function TextPanel() {
  const { accessToken } = useAuth()
  const addClipLocal = useEditorStore((s) => s.addClipLocal)
  const syncAddClip = useEditorStore((s) => s.syncAddClip)
  const clips = useEditorStore((s) => s.clips)
  const currentTime = useEditorStore((s) => s.playback.currentTime)
  const selectClip = useEditorStore((s) => s.selectClip)
  const seek = useEditorStore((s) => s.seek)

  const [customText, setCustomText] = useState("Your text here")

  const addTextClip = async (preset: typeof TEXT_PRESETS[number]) => {
    if (!accessToken) return
    const lastEnd = clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
    const startTime = currentTime > 0 ? currentTime : lastEnd
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
      // Store text metadata in a way the properties panel can read
      // We reuse the `url` field as a JSON payload for text clips
      url: JSON.stringify({
        text: customText || preset.label,
        fontSize: preset.fontSize,
        fontWeight: preset.fontWeight,
        color: preset.color,
      }),
    }
    addClipLocal(localClip)
    await syncAddClip(localClip, accessToken)
    const latest = useEditorStore.getState().clips.find((c) => c.id === localClip.id)
    if (latest) { selectClip(latest.id); seek(latest.startTime) }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Text
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* Custom text input */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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

        {/* Presets */}
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Presets
        </p>
        <div className="flex flex-col gap-2">
          {TEXT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => addTextClip(preset)}
              disabled={!accessToken}
              className="group flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left transition-all hover:border-primary/50 hover:bg-card/80 disabled:opacity-50"
            >
              <span
                className="truncate"
                style={{
                  fontSize: `${Math.min(preset.fontSize * 0.35, 18)}px`,
                  fontWeight: preset.fontWeight,
                  color: preset.color,
                }}
              >
                {preset.label}
              </span>
              <span className="ml-2 shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                + Add
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
