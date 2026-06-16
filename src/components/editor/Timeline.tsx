const tracks = [
  { color: "oklch(0.55 0.18 280)", h: "h-7" },
  { color: "oklch(0.6 0.15 180)", h: "h-5" },
  { color: "oklch(0.65 0.16 30)", h: "h-6" },
  { color: "oklch(0.55 0.14 140)", h: "h-5" },
]

export function Timeline() {
  return (
    <div className="h-48 shrink-0 border-t border-border/60 bg-card/40">
      <div className="flex h-7 items-center gap-1.5 border-b border-border/60 px-2 text-[10px] text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">00:00:00</span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">00:00:42</span>
        <div className="flex-1" />
        <button className="rounded px-2 py-0.5 text-foreground/70 hover:bg-muted">Split</button>
        <button className="rounded px-2 py-0.5 text-foreground/70 hover:bg-muted">Add Track</button>
      </div>
      <div className="space-y-1.5 p-2">
        {tracks.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 text-[10px] text-muted-foreground">Track {i + 1}</span>
            <div className="flex h-5 flex-1 items-end gap-1">
              <div className={`${t.h} flex-1 rounded-sm`} style={{ background: t.color, opacity: 0.6 }} />
              <div className={`${t.h} w-24 rounded-sm`} style={{ background: t.color, opacity: 0.6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
