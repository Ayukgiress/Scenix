import { useEditorStore } from "@/store/editorStore"

function Icon({ name }: { name: string }) {
  const props = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "size-4" }
  switch (name) {
    case "sliders": return <svg {...props}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
    case "scissors": return <svg {...props}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>
    case "trash": return <svg {...props}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
    default: return null
  }
}

export function PropertiesPanel() {
  const selectedClipId = useEditorStore((state) => state.selectedClipId)
  const clips = useEditorStore((state) => state.clips)
  const updateClip = useEditorStore((state) => state.updateClip)
  const deleteClip = useEditorStore((state) => state.deleteClip)
  const selectClip = useEditorStore((state) => state.selectClip)

  const selectedClip = clips.find((c) => c.id === selectedClipId)

  if (!selectedClip) {
    return (
      <aside className="flex h-full w-64 shrink-0 flex-col border-l border-border/60 bg-card/40">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
          <Icon name="sliders" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Properties</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <Icon name="sliders" />
          <div>
            <p className="text-[12px] font-medium text-foreground">No clip selected</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Select a clip on the timeline</p>
          </div>
        </div>
      </aside>
    )
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(2)
    return `${mins}:${secs.padStart(5, "0")}`
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-l border-border/60 bg-card/40">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <Icon name="sliders" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Properties</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-4 rounded-lg border border-border/60 bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Clip Type</span>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-medium uppercase text-primary">
              {selectedClip.type}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">Track {selectedClip.track + 1}</p>
        </div>

        <div className="mb-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Start Time
            </label>
            <input
              type="number"
              step="0.1"
              value={selectedClip.startTime.toFixed(2)}
              onChange={(e) => updateClip(selectedClip.id, { startTime: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-[9px] text-muted-foreground">{formatTime(selectedClip.startTime)}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Duration
            </label>
            <input
              type="number"
              step="0.1"
              value={selectedClip.duration.toFixed(2)}
              onChange={(e) => updateClip(selectedClip.id, { duration: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-[9px] text-muted-foreground">{formatTime(selectedClip.duration)}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Track
            </label>
            <select
              value={selectedClip.track}
              onChange={(e) => updateClip(selectedClip.id, { track: parseInt(e.target.value) })}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {[0, 1, 2, 3].map((track) => (
                <option key={track} value={track}>
                  Track {track + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 space-y-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Trim</div>
          
          <div>
            <label className="mb-1.5 block text-[9px] text-muted-foreground">Trim Start</label>
            <input
              type="range"
              min="0"
              max={(selectedClip.trimEnd || selectedClip.duration).toFixed(2)}
              step="0.1"
              value={selectedClip.trimStart}
              onChange={(e) => updateClip(selectedClip.id, { trimStart: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="mt-1 text-[9px] text-muted-foreground">{formatTime(selectedClip.trimStart)}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[9px] text-muted-foreground">Trim End</label>
            <input
              type="range"
              min={selectedClip.trimStart.toFixed(2)}
              max="100"
              step="0.1"
              value={selectedClip.trimEnd}
              onChange={(e) => updateClip(selectedClip.id, { trimEnd: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="mt-1 text-[9px] text-muted-foreground">{formatTime(selectedClip.trimEnd)}</p>
          </div>
        </div>

        {(selectedClip.type === "video" || selectedClip.type === "audio") && (
          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Volume
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={selectedClip.volume ?? 1}
              onChange={(e) => updateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="mt-1 text-[9px] text-muted-foreground">{Math.round((selectedClip.volume ?? 1) * 100)}%</p>
          </div>
        )}

        <div className="space-y-2 border-t border-border/60 pt-4">
          <button
            onClick={() => {
              deleteClip(selectedClip.id)
              selectClip(null)
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            <Icon name="trash" />
            Delete Clip
          </button>
        </div>
      </div>
    </aside>
  )
}
