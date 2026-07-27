import { useRef, useState, useCallback } from "react"
import { Upload, X, ToggleLeft, ToggleRight } from "lucide-react"
import { parseCube, CubeParseError } from "@/lib/parseCube"
import type { LutSettings } from "@/types/editor"

interface LutPanelProps {
  lut: LutSettings | null
  onChange: (lut: LutSettings | null) => void
  /** Label shown at the top — "Clip LUT" or "Global LUT" */
  label?: string
}

export function LutPanel({ lut, onChange, label = "LUT" }: LutPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".cube")) {
      setError("Only .cube files are supported")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const text = await file.text()
      // Validate parse — throws CubeParseError on bad files
      const parsed = parseCube(text)
      // Create an object URL so the compositor and server can both fetch it
      const url = URL.createObjectURL(file)
      onChange({
        enabled: true,
        url,
        name: parsed.title || file.name.replace(/\.cube$/i, ""),
        intensity: 1,
      })
    } catch (e) {
      setError(e instanceof CubeParseError ? e.message : "Failed to read file")
    } finally {
      setLoading(false)
    }
  }, [onChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  const toggle = () => lut && onChange({ ...lut, enabled: !lut.enabled })
  const remove = () => {
    if (lut?.url.startsWith("blob:")) URL.revokeObjectURL(lut.url)
    onChange(null)
  }
  const setIntensity = (v: number) => lut && onChange({ ...lut, intensity: v })

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      {lut ? (
        <div className="rounded-md border border-border/60 bg-card p-2 space-y-2">
          {/* Name + controls row */}
          <div className="flex items-center gap-1.5">
            <span className="flex-1 truncate text-[11px] text-foreground" title={lut.name}>
              {lut.name}
            </span>
            <button
              onClick={toggle}
              title={lut.enabled ? "Disable LUT" : "Enable LUT"}
              className="text-muted-foreground hover:text-foreground"
            >
              {lut.enabled
                ? <ToggleRight className="size-4 text-primary" />
                : <ToggleLeft  className="size-4" />}
            </button>
            <button onClick={remove} title="Remove LUT" className="text-muted-foreground hover:text-red-400">
              <X className="size-3.5" />
            </button>
          </div>

          {/* Intensity slider */}
          <div>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Intensity</span>
              <span className="text-[9px] text-muted-foreground/70">
                {Math.round(lut.intensity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={lut.intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              disabled={!lut.enabled}
              className="w-full accent-primary disabled:opacity-40"
            />
          </div>

          {/* Replace button */}
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded border border-border/60 bg-background/40 py-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Replace .cube file
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center gap-1.5 rounded-md border border-dashed border-border/60 bg-background/40 px-3 py-4 text-center hover:border-primary/50 hover:bg-muted/30"
        >
          {loading
            ? <span className="text-[10px] text-muted-foreground">Parsing…</span>
            : <>
                <Upload className="size-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  Drop a <strong>.cube</strong> file or click to browse
                </span>
              </>
          }
        </div>
      )}

      {error && (
        <p className="text-[10px] text-red-400">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".cube"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  )
}
