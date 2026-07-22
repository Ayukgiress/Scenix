import { useEditorStore, type LocalClip } from "@/store/editorStore"
import type { ChromaKeySettings } from "@/types/editor"

const DEFAULT: ChromaKeySettings = { enabled: false, color: "#00ff00", tolerance: 0.3, smoothing: 0.1 }

export function ChromaKeyPanel({ clip }: { clip: LocalClip }) {
  const updateClipLocal = useEditorStore((s) => s.updateClipLocal)
  const ck = clip.chromaKey ?? DEFAULT

  const update = (patch: Partial<ChromaKeySettings>) =>
    updateClipLocal(clip.id, { chromaKey: { ...ck, ...patch } })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Enable Chroma Key</span>
        <button
          onClick={() => update({ enabled: !ck.enabled })}
          className={`relative h-5 w-9 rounded-full transition-colors ${ck.enabled ? "bg-primary" : "bg-muted"}`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${ck.enabled ? "translate-x-4" : "translate-x-0.5"}`}
          />
        </button>
      </div>

      {ck.enabled && (
        <>
          <div>
            <label className="mb-1 block text-[10px] text-muted-foreground">Key Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={ck.color}
                onChange={(e) => update({ color: e.target.value })}
                className="h-8 w-16 cursor-pointer rounded border border-border bg-background"
              />
              <div className="flex gap-1">
                {["#00ff00", "#00b140", "#0000ff", "#ff00ff"].map((c) => (
                  <button
                    key={c}
                    onClick={() => update({ color: c })}
                    className={`size-6 rounded border-2 transition-all ${ck.color === c ? "border-primary scale-110" : "border-transparent"}`}
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex justify-between">
              <span className="text-[10px] text-muted-foreground">Tolerance</span>
              <span className="text-[9px] text-primary">{Math.round(ck.tolerance * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.01}
              value={ck.tolerance}
              onChange={(e) => update({ tolerance: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          <div>
            <div className="mb-0.5 flex justify-between">
              <span className="text-[10px] text-muted-foreground">Edge Smoothing</span>
              <span className="text-[9px] text-primary">{Math.round(ck.smoothing * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.01}
              value={ck.smoothing}
              onChange={(e) => update({ smoothing: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-2">
            <p className="text-[9px] text-amber-300">
              Chroma key is applied via CSS mix-blend-mode in preview. Full GPU-accelerated removal is processed during export.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
