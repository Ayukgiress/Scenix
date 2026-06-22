import { useEffect, useRef, useState } from "react"
import { useEditorStore, type LocalClip } from "@/store/editorStore"
import { useAuth } from "@/hooks/useAuth"

function formatTimeDetailed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(2)
  return `${mins}:${secs.padStart(5, "0")}`
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  )
}

function NumberField({
  value,
  onChange,
  step = 0.1,
  min = 0,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
}) {
  const [local, setLocal] = useState(value.toFixed(2))
  return (
    <input
      key={value.toFixed(2)}
      type="number"
      step={step}
      value={local}
      onChange={(e) => {
        const v = e.target.value
        setLocal(v)
        const parsed = parseFloat(v)
        if (!Number.isNaN(parsed)) onChange(Math.max(min, parsed))
      }}
      onBlur={() => setLocal(value.toFixed(2))}
      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  )
}

function EmptyState() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-l border-border/60 bg-card/40">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Properties
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-[12px] font-medium text-foreground">No clip selected</p>
        <p className="text-[10px] text-muted-foreground">
          Click a clip on the timeline to edit
        </p>
      </div>
    </aside>
  )
}

interface PropertiesPanelProps {
  selectedClip: LocalClip
}

function PropertiesContent({ selectedClip }: PropertiesPanelProps) {
  const updateClipLocal = useEditorStore((s) => s.updateClipLocal)
  const syncUpdateClip = useEditorStore((s) => s.syncUpdateClip)
  const syncDeleteClip = useEditorStore((s) => s.syncDeleteClip)
  const selectClip = useEditorStore((s) => s.selectClip)
  const seek = useEditorStore((s) => s.seek)
  const { accessToken } = useAuth()

  // Debounce server sync so dragging a range input doesn't spam the API
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<Partial<LocalClip>>({})

  const queueSync = (updates: Partial<LocalClip>) => {
    Object.assign(pendingRef.current, updates)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (accessToken && Object.keys(pendingRef.current).length > 0) {
        const payload = { ...pendingRef.current }
        pendingRef.current = {}
        syncUpdateClip(selectedClip.id, payload, accessToken)
      }
    }, 350)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleChange = (updates: Partial<LocalClip>) => {
    updateClipLocal(selectedClip.id, updates)
    queueSync(updates)
  }

  const handleDelete = async () => {
    if (accessToken) {
      await syncDeleteClip(selectedClip.id, accessToken)
      selectClip(null)
    }
  }

  const trimMax = Math.max(
    (selectedClip.trimEnd ?? selectedClip.duration) + 50,
    100,
  )

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-l border-border/60 bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Properties
        </span>
        {selectedClip.syncing && (
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            syncing
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-4 rounded-lg border border-border/60 bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Clip
            </span>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-medium uppercase text-primary">
              {selectedClip.type}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Track {selectedClip.track + 1}
          </p>
          <button
            onClick={() => seek(selectedClip.startTime)}
            className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground hover:bg-muted"
          >
            Jump to clip start
          </button>
        </div>

        <div className="mb-4 space-y-3">
          <div>
            <FieldLabel>Start time (s)</FieldLabel>
            <NumberField
              value={selectedClip.startTime}
              min={0}
              step={0.05}
              onChange={(v) => handleChange({ startTime: v })}
            />
            <p className="mt-1 text-[9px] text-muted-foreground">
              {formatTimeDetailed(selectedClip.startTime)}
            </p>
          </div>

          <div>
            <FieldLabel>Duration (s)</FieldLabel>
            <NumberField
              value={selectedClip.duration}
              min={0.1}
              step={0.05}
              onChange={(v) => handleChange({ duration: Math.max(0.1, v) })}
            />
            <p className="mt-1 text-[9px] text-muted-foreground">
              {formatTimeDetailed(selectedClip.duration)}
            </p>
          </div>

          <div>
            <FieldLabel>Track</FieldLabel>
            <select
              value={selectedClip.track}
              onChange={(e) =>
                handleChange({ track: parseInt(e.target.value, 10) })
              }
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {[0, 1, 2, 3].map((t) => (
                <option key={t} value={t}>
                  Track {t + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 space-y-3 border-t border-border/60 pt-4">
          <FieldLabel>Trim start (s)</FieldLabel>
          <input
            type="range"
            min={0}
            max={trimMax}
            step={0.05}
            value={selectedClip.trimStart ?? 0}
            onChange={(e) =>
              handleChange({ trimStart: parseFloat(e.target.value) })
            }
            className="w-full accent-primary"
          />
          <p className="text-[9px] text-muted-foreground">
            {formatTimeDetailed(selectedClip.trimStart ?? 0)}
          </p>

          <FieldLabel>Trim end (s)</FieldLabel>
          <input
            type="range"
            min={0}
            max={trimMax}
            step={0.05}
            value={selectedClip.trimEnd ?? selectedClip.duration}
            onChange={(e) =>
              handleChange({ trimEnd: parseFloat(e.target.value) })
            }
            className="w-full accent-primary"
          />
          <p className="text-[9px] text-muted-foreground">
            {formatTimeDetailed(selectedClip.trimEnd ?? selectedClip.duration)}
          </p>
        </div>

        {(selectedClip.type === "video" || selectedClip.type === "audio") && (
          <div className="mb-4 border-t border-border/60 pt-4">
            <FieldLabel>Volume</FieldLabel>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedClip.volume ?? 1}
              onChange={(e) =>
                handleChange({ volume: parseFloat(e.target.value) })
              }
              className="w-full accent-primary"
            />
            <p className="mt-1 text-[9px] text-muted-foreground">
              {Math.round((selectedClip.volume ?? 1) * 100)}%
            </p>
          </div>
        )}

        <div className="space-y-2 border-t border-border/60 pt-4">
          <button
            onClick={handleDelete}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete clip
          </button>
        </div>
      </div>
    </aside>
  )
}

export function PropertiesPanel() {
  const selectedClipId = useEditorStore((s) => s.selectedClipId)
  const clips = useEditorStore((s) => s.clips)
  const selectedClip = clips.find((c) => c.id === selectedClipId) ?? null

  if (!selectedClip) return <EmptyState />
  return <PropertiesContent selectedClip={selectedClip} />
}