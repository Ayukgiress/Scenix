export function MediaPanel() {
  const items = Array.from({ length: 8 }).map((_, i) => i)
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border/60 bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Media
        <button className="text-foreground/60 hover:text-foreground">+</button>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-2">
        {items.map((i) => (
          <div
            key={i}
            className="aspect-video rounded-sm border border-border/60"
            style={{
              background: `linear-gradient(135deg, oklch(0.3 0.06 ${i * 45}), oklch(0.45 0.1 ${i * 70 + 30}))`,
            }}
          />
        ))}
      </div>
    </aside>
  )
}
