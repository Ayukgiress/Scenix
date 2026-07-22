import { useEditorStore, type LocalClip } from "@/store/editorStore"
import type { ColorGradeSettings } from "@/types/editor"
import { RotateCcw } from "lucide-react"

const DEFAULT_GRADE: ColorGradeSettings = {
  brightness: 0, contrast: 0, saturation: 0, hue: 0,
  temperature: 0, tint: 0, highlights: 0, shadows: 0, vignette: 0,
}

const CONTROLS: {
  key: keyof ColorGradeSettings
  label: string
  min: number
  max: number
  step: number
  format: (v: number) => string
}[] = [
  { key: "brightness",  label: "Brightness",  min: -1,   max: 1,   step: 0.01, format: (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}` },
  { key: "contrast",    label: "Contrast",    min: -1,   max: 1,   step: 0.01, format: (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}` },
  { key: "saturation",  label: "Saturation",  min: -1,   max: 1,   step: 0.01, format: (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}` },
  { key: "hue",         label: "Hue",         min: -180, max: 180, step: 1,    format: (v) => `${v}°` },
  { key: "temperature", label: "Temperature", min: -100, max: 100, step: 1,    format: (v) => `${v > 0 ? "+" : ""}${v}` },
  { key: "tint",        label: "Tint",        min: -100, max: 100, step: 1,    format: (v) => `${v > 0 ? "+" : ""}${v}` },
  { key: "highlights",  label: "Highlights",  min: -1,   max: 1,   step: 0.01, format: (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}` },
  { key: "shadows",     label: "Shadows",     min: -1,   max: 1,   step: 0.01, format: (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}` },
  { key: "vignette",    label: "Vignette",    min: 0,    max: 1,   step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
]

/** Convert ColorGradeSettings to a CSS filter string */
export function colorGradeToFilter(g: ColorGradeSettings): string {
  const brightness = 1 + g.brightness
  const contrast = 1 + g.contrast
  const saturate = 1 + g.saturation
  const hueRotate = g.hue
  return [
    `brightness(${brightness.toFixed(3)})`,
    `contrast(${contrast.toFixed(3)})`,
    `saturate(${saturate.toFixed(3)})`,
    `hue-rotate(${hueRotate}deg)`,
  ].join(" ")
}

export function ColorGradePanel({ clip }: { clip: LocalClip }) {
  const updateClipLocal = useEditorStore((s) => s.updateClipLocal)
  const pushHistory = useEditorStore((s) => s.pushHistory)
  const grade = clip.colorGrade ?? DEFAULT_GRADE

  const update = (key: keyof ColorGradeSettings, value: number) => {
    updateClipLocal(clip.id, { colorGrade: { ...grade, [key]: value } })
  }

  const reset = () => {
    pushHistory()
    updateClipLocal(clip.id, { colorGrade: { ...DEFAULT_GRADE } })
  }

  const isModified = Object.keys(DEFAULT_GRADE).some(
    (k) => (grade[k as keyof ColorGradeSettings] ?? 0) !== DEFAULT_GRADE[k as keyof ColorGradeSettings]
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Color Grading</p>
        {isModified && (
          <button
            onClick={reset}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="size-2.5" /> Reset
          </button>
        )}
      </div>

      {/* Preview swatch */}
      <div
        className="h-8 w-full rounded-md bg-gradient-to-r from-red-500 via-green-400 to-blue-500"
        style={{ filter: colorGradeToFilter(grade) }}
      />

      {CONTROLS.map(({ key, label, min, max, step, format }) => {
        const value = grade[key] ?? 0
        const isDefault = value === DEFAULT_GRADE[key]
        return (
          <div key={key}>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <div className="flex items-center gap-1">
                <span className={`text-[9px] ${isDefault ? "text-muted-foreground/50" : "text-primary"}`}>
                  {format(value)}
                </span>
                {!isDefault && (
                  <button
                    onClick={() => update(key, DEFAULT_GRADE[key])}
                    className="text-[8px] text-muted-foreground/50 hover:text-muted-foreground"
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onFocus={() => pushHistory()}
              onChange={(e) => update(key, parseFloat(e.target.value))}
              onDoubleClick={() => update(key, DEFAULT_GRADE[key])}
              className="w-full accent-primary"
            />
          </div>
        )
      })}
    </div>
  )
}
