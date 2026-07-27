import { useRef, useState, useCallback, useEffect } from "react"
import { RotateCcw } from "lucide-react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import type { ColorGradeSettings, CurvePoint, ToneCurves, SecondaryCorrection, SecondaryQualifier } from "@/types/editor"

// ── defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CURVE_POINTS: CurvePoint[] = [[0,0],[0.25,0.25],[0.5,0.5],[0.75,0.75],[1,1]]

const DEFAULT_CURVES: ToneCurves = {
  luma: [...DEFAULT_CURVE_POINTS],
  r:    [...DEFAULT_CURVE_POINTS],
  g:    [...DEFAULT_CURVE_POINTS],
  b:    [...DEFAULT_CURVE_POINTS],
}

const DEFAULT_QUALIFIER: SecondaryQualifier = {
  hueCenter: 120, hueWidth: 30,
  satMin: 0.1, satMax: 1,
  lumMin: 0,   lumMax: 1,
}

const DEFAULT_SECONDARY: SecondaryCorrection = {
  enabled: false,
  qualifier: { ...DEFAULT_QUALIFIER },
  hue: 0, saturation: 0, brightness: 0,
}

const DEFAULT_GRADE: ColorGradeSettings = {
  brightness: 0, contrast: 0, saturation: 0, hue: 0,
  temperature: 0, tint: 0, highlights: 0, shadows: 0, vignette: 0,
}

// ── CSS filter helper (used by compositor for basic sliders) ──────────────────

export function colorGradeToFilter(g: ColorGradeSettings): string {
  const brightness = 1 + g.brightness
  const contrast   = 1 + g.contrast
  const saturate   = 1 + g.saturation
  const hueRotate  = g.hue
  return [
    `brightness(${brightness.toFixed(3)})`,
    `contrast(${contrast.toFixed(3)})`,
    `saturate(${saturate.toFixed(3)})`,
    `hue-rotate(${hueRotate}deg)`,
  ].join(" ")
}

// ── curve math ────────────────────────────────────────────────────────────────

function evalCurve(pts: CurvePoint[], x: number): number {
  const sorted = [...pts].sort((a, b) => a[0] - b[0])
  const n = sorted.length
  if (n === 0) return x
  if (x <= sorted[0][0]) return sorted[0][1]
  if (x >= sorted[n-1][0]) return sorted[n-1][1]
  let i = 0
  while (i < n - 2 && sorted[i+1][0] < x) i++
  const [x0, y0] = sorted[i], [x1, y1] = sorted[i+1]
  const h = x1 - x0
  if (h < 1e-9) return y0
  const m0 = i > 0
    ? 0.5 * ((y1 - y0) / h + (y0 - sorted[i-1][1]) / (x0 - sorted[i-1][0]))
    : (y1 - y0) / h
  const m1 = i < n - 2
    ? 0.5 * ((y1 - y0) / h + (sorted[i+2][1] - y1) / (sorted[i+2][0] - x1))
    : (y1 - y0) / h
  const t = (x - x0) / h, t2 = t*t, t3 = t2*t
  return (2*t3-3*t2+1)*y0 + (t3-2*t2+t)*h*m0 + (-2*t3+3*t2)*y1 + (t3-t2)*h*m1
}

function curveToPath(pts: CurvePoint[], W: number, H: number): string {
  const steps = 64
  const points: string[] = []
  for (let i = 0; i <= steps; i++) {
    const x = i / steps
    const y = Math.min(1, Math.max(0, evalCurve(pts, x)))
    points.push(`${(x * W).toFixed(1)},${((1 - y) * H).toFixed(1)}`)
  }
  return "M " + points.join(" L ")
}

// ── CurveEditor ───────────────────────────────────────────────────────────────

const CURVE_COLORS = { luma: "#e2e8f0", r: "#f87171", g: "#4ade80", b: "#60a5fa" } as const
type CurveChannel = keyof typeof CURVE_COLORS

function CurveEditor({
  curves,
  onChange,
}: {
  curves: ToneCurves
  onChange: (c: ToneCurves) => void
}) {
  const [activeChannel, setActiveChannel] = useState<CurveChannel>("luma")
  const [dragging, setDragging] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const W = 180, H = 140

  const pts = curves[activeChannel]

  const svgCoord = useCallback((e: React.MouseEvent | MouseEvent): [number, number] => {
    const svg = svgRef.current
    if (!svg) return [0, 0]
    const rect = svg.getBoundingClientRect()
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, 1 - (e.clientY - rect.top)  / rect.height)),
    ]
  }, [])

  const updatePts = useCallback((next: CurvePoint[]) => {
    onChange({ ...curves, [activeChannel]: next })
  }, [curves, activeChannel, onChange])

  const handleMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault()
    setDragging(idx)
  }, [])

  useEffect(() => {
    if (dragging === null) return
    const onMove = (e: MouseEvent) => {
      const [nx, ny] = svgCoord(e)
      const next = pts.map((p, i): CurvePoint => i === dragging ? [nx, ny] : p)
      updatePts(next)
    }
    const onUp = () => setDragging(null)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [dragging, pts, svgCoord, updatePts])

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging !== null) return
    const [nx, ny] = svgCoord(e)
    // Don't add if clicking near an existing point
    const near = pts.some(([px, py]) => Math.hypot(px - nx, py - ny) < 0.06)
    if (!near) updatePts([...pts, [nx, ny]])
  }, [dragging, pts, svgCoord, updatePts])

  const removePoint = useCallback((idx: number) => {
    if (pts.length <= 2) return
    updatePts(pts.filter((_, i) => i !== idx))
  }, [pts, updatePts])

  const resetChannel = () => onChange({ ...curves, [activeChannel]: [...DEFAULT_CURVE_POINTS] })

  const color = CURVE_COLORS[activeChannel]

  return (
    <div className="space-y-2">
      {/* Channel tabs */}
      <div className="flex gap-1">
        {(Object.keys(CURVE_COLORS) as CurveChannel[]).map((ch) => (
          <button
            key={ch}
            onClick={() => setActiveChannel(ch)}
            className={`flex-1 rounded py-0.5 text-[10px] font-medium transition-colors ${
              activeChannel === ch
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={activeChannel === ch ? { color: CURVE_COLORS[ch] } : {}}
          >
            {ch === "luma" ? "L" : ch.toUpperCase()}
          </button>
        ))}
        <button
          onClick={resetChannel}
          className="rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground"
          title="Reset channel"
        >
          ↺
        </button>
      </div>

      {/* SVG curve canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W} height={H}
        className="w-full cursor-crosshair rounded-md border border-border/60 bg-[#0d0d0f]"
        onClick={handleSvgClick}
      >
        {/* Grid */}
        {[0.25, 0.5, 0.75].map((v) => (
          <g key={v}>
            <line x1={v*W} y1={0} x2={v*W} y2={H} stroke="#ffffff10" strokeWidth={0.5} />
            <line x1={0} y1={v*H} x2={W} y2={v*H} stroke="#ffffff10" strokeWidth={0.5} />
          </g>
        ))}
        {/* Diagonal reference */}
        <line x1={0} y1={H} x2={W} y2={0} stroke="#ffffff18" strokeWidth={0.5} strokeDasharray="3 3" />
        {/* Curve */}
        <path
          d={curveToPath(pts, W, H)}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Control points */}
        {pts.map(([px, py], idx) => (
          <circle
            key={idx}
            cx={px * W}
            cy={(1 - py) * H}
            r={4}
            fill={color}
            stroke="#0d0d0f"
            strokeWidth={1.5}
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => handleMouseDown(e, idx)}
            onDoubleClick={(e) => { e.stopPropagation(); removePoint(idx) }}
          />
        ))}
      </svg>
      <p className="text-[9px] text-muted-foreground/50">Click to add · Double-click point to remove</p>
    </div>
  )
}

// ── SecondaryPanel ────────────────────────────────────────────────────────────

function SliderMini({
  label, value, min, max, step, onChange, format,
}: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; format?: (v: number) => string
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[9px] text-muted-foreground/70">{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  )
}

function SecondaryPanel({
  secondary,
  onChange,
}: {
  secondary: SecondaryCorrection
  onChange: (s: SecondaryCorrection) => void
}) {
  const q = secondary.qualifier
  const setQ = (patch: Partial<SecondaryQualifier>) =>
    onChange({ ...secondary, qualifier: { ...q, ...patch } })
  const setAdj = (patch: Partial<Pick<SecondaryCorrection, "hue" | "saturation" | "brightness">>) =>
    onChange({ ...secondary, ...patch })

  return (
    <div className="space-y-3">
      {/* Enable toggle */}
      <label className="flex cursor-pointer items-center justify-between text-[11px] text-foreground">
        <span>Enable secondary</span>
        <input
          type="checkbox"
          checked={secondary.enabled}
          onChange={(e) => onChange({ ...secondary, enabled: e.target.checked })}
          className="size-3.5 accent-primary"
        />
      </label>

      <div className={secondary.enabled ? "" : "pointer-events-none opacity-40"}>
        {/* Hue qualifier — visual hue wheel strip */}
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Qualifier</p>

        {/* Hue wheel strip */}
        <div className="relative mb-2 h-4 w-full overflow-hidden rounded">
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to right, hsl(0,80%,50%), hsl(60,80%,50%), hsl(120,80%,50%), hsl(180,80%,50%), hsl(240,80%,50%), hsl(300,80%,50%), hsl(360,80%,50%))",
            }}
          />
          {/* Selected range indicator */}
          <div
            className="absolute inset-y-0 border-2 border-white/80 rounded"
            style={{
              left:  `${Math.max(0, (q.hueCenter - q.hueWidth) / 360 * 100)}%`,
              right: `${Math.max(0, (1 - (q.hueCenter + q.hueWidth) / 360) * 100)}%`,
            }}
          />
        </div>

        <SliderMini label="Hue center" value={q.hueCenter} min={0} max={360} step={1}
          onChange={(v) => setQ({ hueCenter: v })} format={(v) => `${v}°`} />
        <SliderMini label="Hue width"  value={q.hueWidth}  min={0} max={180} step={1}
          onChange={(v) => setQ({ hueWidth: v })}  format={(v) => `±${v}°`} />
        <SliderMini label="Sat min"    value={q.satMin}    min={0} max={1}   step={0.01}
          onChange={(v) => setQ({ satMin: v })}    format={(v) => `${Math.round(v*100)}%`} />
        <SliderMini label="Sat max"    value={q.satMax}    min={0} max={1}   step={0.01}
          onChange={(v) => setQ({ satMax: v })}    format={(v) => `${Math.round(v*100)}%`} />
        <SliderMini label="Lum min"    value={q.lumMin}    min={0} max={1}   step={0.01}
          onChange={(v) => setQ({ lumMin: v })}    format={(v) => `${Math.round(v*100)}%`} />
        <SliderMini label="Lum max"    value={q.lumMax}    min={0} max={1}   step={0.01}
          onChange={(v) => setQ({ lumMax: v })}    format={(v) => `${Math.round(v*100)}%`} />

        <p className="mb-1 mt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Adjustments</p>
        <SliderMini label="Hue"        value={secondary.hue}        min={-180} max={180} step={1}
          onChange={(v) => setAdj({ hue: v })}        format={(v) => `${v > 0 ? "+" : ""}${v}°`} />
        <SliderMini label="Saturation" value={secondary.saturation} min={-1}   max={1}   step={0.01}
          onChange={(v) => setAdj({ saturation: v })} format={(v) => `${v > 0 ? "+" : ""}${Math.round(v*100)}`} />
        <SliderMini label="Brightness" value={secondary.brightness} min={-1}   max={1}   step={0.01}
          onChange={(v) => setAdj({ brightness: v })} format={(v) => `${v > 0 ? "+" : ""}${Math.round(v*100)}`} />

        <button
          onClick={() => onChange({ ...DEFAULT_SECONDARY, enabled: secondary.enabled })}
          className="mt-1 w-full rounded border border-border/60 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          Reset secondary
        </button>
      </div>
    </div>
  )
}

// ── BasicPanel ────────────────────────────────────────────────────────────────

const BASIC_CONTROLS: {
  key: keyof ColorGradeSettings
  label: string; min: number; max: number; step: number
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

// ── Main panel ────────────────────────────────────────────────────────────────

type Tab = "basic" | "curves" | "secondary"

export function ColorGradePanel({ clip }: { clip: LocalClip }) {
  const updateClipLocal = useEditorStore((s) => s.updateClipLocal)
  const pushHistory     = useEditorStore((s) => s.pushHistory)
  const grade = clip.colorGrade ?? DEFAULT_GRADE
  const [tab, setTab] = useState<Tab>("basic")

  const update = (patch: Partial<ColorGradeSettings>) => {
    updateClipLocal(clip.id, { colorGrade: { ...grade, ...patch } })
  }

  const curves    = grade.curves    ?? DEFAULT_CURVES
  const secondary = grade.secondary ?? DEFAULT_SECONDARY

  const isBasicModified = (Object.keys(DEFAULT_GRADE) as (keyof ColorGradeSettings)[])
    .filter((k) => k !== "curves" && k !== "secondary")
    .some((k) => (grade[k] as number ?? 0) !== (DEFAULT_GRADE[k] as number))

  const isCurvesModified = grade.curves !== undefined
  const isSecModified    = grade.secondary?.enabled

  const resetAll = () => { pushHistory(); update({ ...DEFAULT_GRADE, curves: undefined, secondary: undefined }) }

  const anyModified = isBasicModified || isCurvesModified || isSecModified

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5 rounded-md border border-border/60 bg-muted/30 p-0.5">
          {(["basic", "curves", "secondary"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "basic" ? "Basic" : t === "curves" ? "Curves" : "2nd"}
              {t === "curves" && isCurvesModified && <span className="ml-0.5 inline-block size-1 rounded-full bg-primary align-middle" />}
              {t === "secondary" && isSecModified  && <span className="ml-0.5 inline-block size-1 rounded-full bg-primary align-middle" />}
            </button>
          ))}
        </div>
        {anyModified && (
          <button
            onClick={resetAll}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="size-2.5" /> Reset all
          </button>
        )}
      </div>

      {/* Preview swatch */}
      <div
        className="h-6 w-full rounded bg-gradient-to-r from-red-500 via-green-400 to-blue-500"
        style={{ filter: colorGradeToFilter(grade) }}
      />

      {/* Tab content */}
      {tab === "basic" && (
        <div className="space-y-1.5">
          {BASIC_CONTROLS.map(({ key, label, min, max, step, format }) => {
            const value = (grade[key] as number) ?? 0
            const isDefault = value === (DEFAULT_GRADE[key] as number)
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
                        onClick={() => update({ [key]: DEFAULT_GRADE[key] })}
                        className="text-[8px] text-muted-foreground/50 hover:text-muted-foreground"
                      >↺</button>
                    )}
                  </div>
                </div>
                <input
                  type="range" min={min} max={max} step={step} value={value}
                  onFocus={() => pushHistory()}
                  onChange={(e) => update({ [key]: parseFloat(e.target.value) })}
                  onDoubleClick={() => update({ [key]: DEFAULT_GRADE[key] })}
                  className="w-full accent-primary"
                />
              </div>
            )
          })}
        </div>
      )}

      {tab === "curves" && (
        <CurveEditor
          curves={curves}
          onChange={(c) => update({ curves: c })}
        />
      )}

      {tab === "secondary" && (
        <SecondaryPanel
          secondary={secondary}
          onChange={(s) => update({ secondary: s })}
        />
      )}
    </div>
  )
}
