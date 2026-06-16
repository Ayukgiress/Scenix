function PlayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

export function PreviewPanel() {
  return (
    <section className="flex flex-1 flex-col bg-black/40 p-4">
      <div className="relative aspect-video w-full flex-1 overflow-hidden rounded-md border border-border/40 bg-gradient-to-br from-[oklch(0.25_0.08_280)] to-[oklch(0.15_0.05_220)]">
        <div className="absolute inset-0 grid place-items-center">
          <button className="grid size-12 place-items-center rounded-full bg-background/90 text-foreground shadow-lg backdrop-blur">
            <PlayIcon className="size-5" />
          </button>
        </div>
        <div className="absolute bottom-1.5 left-1.5 rounded bg-background/70 px-1.5 py-0.5 font-mono text-[9px] text-foreground">
          00:00 / 00:42
        </div>
      </div>
    </section>
  )
}
