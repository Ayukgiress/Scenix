const properties = [
  { label: "Opacity", value: "100%" },
  { label: "Volume", value: "0 dB" },
  { label: "Position", value: "0, 0" },
  { label: "Scale", value: "1.0x" },
  { label: "Rotation", value: "0°" },
  { label: "Effects", value: "None" },
]

export function PropertiesPanel() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-l border-border/60 bg-card/40">
      <div className="border-b border-border/60 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Properties
      </div>
      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {properties.map((p) => (
          <div
            key={p.label}
            className="flex items-center justify-between rounded border border-border/40 bg-background/50 px-2 py-1.5 text-[11px]"
          >
            <span className="text-muted-foreground">{p.label}</span>
            <span className="font-mono text-foreground/80">{p.value}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}
