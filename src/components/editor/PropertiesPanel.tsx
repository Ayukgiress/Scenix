import { useEffect, useRef, useState } from "react";
import { useEditorStore, type LocalClip } from "@/store/editorStore";
import { useAuth } from "@/hooks/useAuth";

function formatTimeDetailed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, "0")}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

function NumberField({ value, onChange, step = 0.1, min = 0, max }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number;
}) {
  const [local, setLocal] = useState(value.toFixed(2));
  return (
    <input
      key={value.toFixed(2)}
      type="number" step={step} value={local}
      onChange={(e) => {
        const v = e.target.value; setLocal(v);
        const parsed = parseFloat(v);
        if (!Number.isNaN(parsed)) {
          const clamped = max !== undefined ? Math.min(max, Math.max(min, parsed)) : Math.max(min, parsed);
          onChange(clamped);
        }
      }}
      onBlur={() => setLocal(value.toFixed(2))}
      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}

function SliderRow({ label, value, min, max, step, onChange, display }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-[9px] text-muted-foreground">{display ?? value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

const VIDEO_FILTERS = [
  { label: "None", value: "" },
  { label: "Vivid", value: "saturate(1.8) contrast(1.1)" },
  { label: "Matte", value: "contrast(0.9) brightness(1.05) saturate(0.8)" },
  { label: "B&W", value: "grayscale(1)" },
  { label: "Warm", value: "sepia(0.4) saturate(1.3)" },
  { label: "Cool", value: "hue-rotate(30deg) saturate(1.2)" },
  { label: "Fade", value: "opacity(0.85) brightness(1.1) contrast(0.9)" },
]

function EmptyState() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-l border-border/60 bg-card/40">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Properties</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-[12px] font-medium text-foreground">No clip selected</p>
        <p className="text-[10px] text-muted-foreground">Click a clip on the timeline to edit</p>
        <p className="mt-2 text-[9px] text-muted-foreground/60">
          Tip: Press <kbd className="rounded bg-muted px-1 py-0.5 font-mono">S</kbd> to split at playhead
        </p>
      </div>
    </aside>
  );
}

function PropertiesContent({ selectedClip }: { selectedClip: LocalClip }) {
  const updateClipLocal = useEditorStore((s) => s.updateClipLocal);
  const syncUpdateClip = useEditorStore((s) => s.syncUpdateClip);
  const syncDeleteClip = useEditorStore((s) => s.syncDeleteClip);
  const splitClip = useEditorStore((s) => s.splitClip);
  const selectClip = useEditorStore((s) => s.selectClip);
  const seek = useEditorStore((s) => s.seek);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const { accessToken } = useAuth();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<LocalClip>>({});

  const queueSync = (updates: Partial<LocalClip>) => {
    Object.assign(pendingRef.current, updates);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (accessToken && Object.keys(pendingRef.current).length > 0) {
        const payload = { ...pendingRef.current };
        pendingRef.current = {};
        syncUpdateClip(selectedClip.id, payload, accessToken);
      }
    }, 350);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, []);

  const handleChange = (updates: Partial<LocalClip>) => {
    updateClipLocal(selectedClip.id, updates);
    queueSync(updates);
  };

  const handleDelete = async () => {
    if (accessToken) { await syncDeleteClip(selectedClip.id, accessToken); selectClip(null) }
  };

  const handleSplit = async () => {
    if (accessToken) {
      await splitClip(selectedClip.id, currentTime, accessToken);
      selectClip(null);
    }
  };

  const trimMax = Math.max((selectedClip.trimEnd ?? selectedClip.duration) + 50, 100);

  // Text clip data
  let textData = { text: "Text", fontSize: 32, fontWeight: "bold", color: "#ffffff" };
  if (selectedClip.type === "text" && selectedClip.url) {
    try { textData = { ...textData, ...JSON.parse(selectedClip.url) } } catch { /* ignore */ }
  }
  const updateText = (patch: Partial<typeof textData>) => {
    const next = { ...textData, ...patch };
    handleChange({ url: JSON.stringify(next) });
  };

  // Filter for video
  const currentFilter = (selectedClip.metadata?.filter as string) ?? "";
  const updateFilter = (filter: string) => {
    const meta = { ...(selectedClip.metadata ?? {}), filter };
    handleChange({ metadata: meta });
  };

  const canSplit =
    currentTime > selectedClip.startTime + 0.1 &&
    currentTime < selectedClip.startTime + selectedClip.duration - 0.1;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-l border-border/60 bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Properties</span>
        {selectedClip.syncing && (
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />syncing
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* Clip info */}
        <div className="mb-4 rounded-lg border border-border/60 bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Clip</span>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-medium uppercase text-primary">{selectedClip.type}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Track {selectedClip.track + 1}</p>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={() => seek(selectedClip.startTime)}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground hover:bg-muted"
            >
              Jump to start
            </button>
            <button
              onClick={handleSplit}
              disabled={!canSplit}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground hover:bg-muted disabled:opacity-40"
              title={canSplit ? "Split at playhead (S)" : "Move playhead inside clip to split"}
            >
              ✂ Split
            </button>
          </div>
        </div>

        {/* Timing */}
        <div className="mb-4 space-y-3">
          <div>
            <FieldLabel>Start time (s)</FieldLabel>
            <NumberField value={selectedClip.startTime} min={0} step={0.05} onChange={(v) => handleChange({ startTime: v })} />
            <p className="mt-1 text-[9px] text-muted-foreground">{formatTimeDetailed(selectedClip.startTime)}</p>
          </div>
          <div>
            <FieldLabel>Duration (s)</FieldLabel>
            <NumberField value={selectedClip.duration} min={0.1} step={0.05} onChange={(v) => handleChange({ duration: Math.max(0.1, v) })} />
            <p className="mt-1 text-[9px] text-muted-foreground">{formatTimeDetailed(selectedClip.duration)}</p>
          </div>
          <div>
            <FieldLabel>Track</FieldLabel>
            <select
              value={selectedClip.track}
              onChange={(e) => handleChange({ track: parseInt(e.target.value, 10) })}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary"
            >
              {[0, 1, 2, 3].map((t) => <option key={t} value={t}>Track {t + 1}</option>)}
            </select>
          </div>
        </div>

        {/* Trim */}
        <div className="mb-4 space-y-3 border-t border-border/60 pt-4">
          <SliderRow
            label="Trim start (s)" value={selectedClip.trimStart ?? 0}
            min={0} max={trimMax} step={0.05}
            onChange={(v) => handleChange({ trimStart: v })}
            display={formatTimeDetailed(selectedClip.trimStart ?? 0)}
          />
          <SliderRow
            label="Trim end (s)" value={selectedClip.trimEnd ?? selectedClip.duration}
            min={0} max={trimMax} step={0.05}
            onChange={(v) => handleChange({ trimEnd: v })}
            display={formatTimeDetailed(selectedClip.trimEnd ?? selectedClip.duration)}
          />
        </div>

        {/* Volume (video/audio) */}
        {(selectedClip.type === "video" || selectedClip.type === "audio") && (
          <div className="mb-4 space-y-3 border-t border-border/60 pt-4">
            <SliderRow
              label="Volume" value={selectedClip.volume ?? 1}
              min={0} max={1} step={0.01}
              onChange={(v) => handleChange({ volume: v })}
              display={`${Math.round((selectedClip.volume ?? 1) * 100)}%`}
            />
          </div>
        )}

        {/* Video-specific: opacity, rotation, speed, filter */}
        {selectedClip.type === "video" && (
          <div className="mb-4 space-y-3 border-t border-border/60 pt-4">
            <SliderRow
              label="Opacity" value={selectedClip.opacity ?? 1}
              min={0} max={1} step={0.01}
              onChange={(v) => handleChange({ opacity: v })}
              display={`${Math.round((selectedClip.opacity ?? 1) * 100)}%`}
            />
            <SliderRow
              label="Rotation (°)" value={selectedClip.rotation ?? 0}
              min={-180} max={180} step={1}
              onChange={(v) => handleChange({ rotation: v })}
              display={`${selectedClip.rotation ?? 0}°`}
            />
            <div>
              <FieldLabel>Filter</FieldLabel>
              <select
                value={currentFilter}
                onChange={(e) => updateFilter(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary"
              >
                {VIDEO_FILTERS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Text clip editing */}
        {selectedClip.type === "text" && (
          <div className="mb-4 space-y-3 border-t border-border/60 pt-4">
            <div>
              <FieldLabel>Text content</FieldLabel>
              <textarea
                rows={2} value={textData.text}
                onChange={(e) => updateText({ text: e.target.value })}
                className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <FieldLabel>Font size</FieldLabel>
              <NumberField value={textData.fontSize} min={8} step={1} onChange={(v) => updateText({ fontSize: v })} />
            </div>
            <div>
              <FieldLabel>Color</FieldLabel>
              <input
                type="color" value={textData.color}
                onChange={(e) => updateText({ color: e.target.value })}
                className="h-8 w-full cursor-pointer rounded-md border border-border bg-background"
              />
            </div>
            <div>
              <FieldLabel>Weight</FieldLabel>
              <select
                value={textData.fontWeight}
                onChange={(e) => updateText({ fontWeight: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary"
              >
                <option value="normal">Normal</option>
                <option value="500">Medium</option>
                <option value="600">Semi Bold</option>
                <option value="bold">Bold</option>
              </select>
            </div>
          </div>
        )}

        {/* Delete */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <button
            onClick={handleDelete}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-medium text-red-400 hover:bg-red-500/20"
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
  );
}

export function PropertiesPanel() {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const clips = useEditorStore((s) => s.clips);
  const selectedClip = clips.find((c) => c.id === selectedClipId) ?? null;
  if (!selectedClip) return <EmptyState />;
  return <PropertiesContent selectedClip={selectedClip} />;
}
