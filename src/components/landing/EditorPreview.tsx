import { useEffect, useRef, useState } from "react"
import type { ReactNode, SVGProps } from "react"

function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.03-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  )
}

const OUTPUTS = [
  { label: "Cinematic intro",   hue: 285, w: "62%" },
  { label: "Beat sync cut",     hue: 200, w: "45%" },
  { label: "Aerial timelapse",  hue: 170, w: "78%" },
  { label: "Noise removed",     hue: 60,  w: "55%" },
]

function GeneratingCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    let raf: number
    let t = 0

    const draw = () => {
      raf = requestAnimationFrame(draw)
      t += 0.012
      c.width = c.offsetWidth
      c.height = c.offsetHeight
      const w = c.width, h = c.height

      ctx.clearRect(0, 0, w, h)

      // rolling scanlines
      for (let y = 0; y < h; y += 3) {
        const alpha = 0.03 + 0.025 * Math.sin(y * 0.08 - t * 2)
        ctx.fillStyle = `oklch(0.72 0.14 285 / ${alpha})`
        ctx.fillRect(0, y, w, 1)
      }

      // centre orb pulse
      const cx = w / 2, cy = h / 2
      const r = 55 + Math.sin(t * 1.8) * 12
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5)
      g.addColorStop(0,   `oklch(0.72 0.18 285 / 0.28)`)
      g.addColorStop(0.4, `oklch(0.65 0.15 260 / 0.14)`)
      g.addColorStop(1,   `oklch(0.5  0.1  285 / 0)`)
      ctx.beginPath()
      ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()

      // orbiting particles
      for (let i = 0; i < 6; i++) {
        const angle = t * 0.9 + (i * Math.PI * 2) / 6
        const rad   = 38 + Math.sin(t + i) * 8
        const px = cx + Math.cos(angle) * rad
        const py = cy + Math.sin(angle) * rad
        ctx.beginPath()
        ctx.arc(px, py, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = `oklch(0.82 0.16 ${260 + i * 12} / 0.8)`
        ctx.fill()
      }

      // waveform bar at bottom
      const bars = 40, bw = w / bars
      for (let i = 0; i < bars; i++) {
        const bh = 6 + Math.abs(Math.sin(i * 0.45 + t * 3)) * 18
        const alpha = 0.3 + Math.abs(Math.sin(i * 0.45 + t * 3)) * 0.5
        ctx.fillStyle = `oklch(0.72 0.14 285 / ${alpha})`
        ctx.fillRect(i * bw + 1, h - bh - 8, bw - 2, bh)
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />
}

export function EditorPreview() {
  const [active, setActive] = useState(0)

  return (
    <div className="flex flex-col gap-3">
      {/* Main preview card */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-[oklch(0.13_0.008_270)] shadow-[0_0_0_1px_oklch(0.72_0.14_285/0.12),0_32px_64px_-16px_oklch(0_0_0/0.7)]">
        {/* Topbar */}
        <div className="flex items-center gap-2 border-b border-border bg-[oklch(0.16_0.006_265)] px-4 py-2">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-foreground/10" />
            <span className="size-2.5 rounded-full bg-foreground/10" />
            <span className="size-2.5 rounded-full bg-foreground/10" />
          </div>
          <div className="ml-3 flex items-center gap-1.5 rounded-md bg-[oklch(0.72_0.14_285/0.12)] px-2.5 py-1">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-medium text-primary">Generating…</span>
          </div>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">00:00:24 / 00:01:00</span>
        </div>

        {/* Canvas area */}
        <div className="relative aspect-video w-full bg-[oklch(0.11_0.006_270)]">
          <GeneratingCanvas />
          {/* centre icon */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="grid size-14 place-items-center rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_24px_oklch(0.72_0.14_285/0.3)]">
              <PlayIcon className="size-5 text-primary" />
            </div>
            <span className="rounded-full border border-border bg-background/40 px-3 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur-sm">
              Cinematic drone intro · 4K · 60fps
            </span>
          </div>
          {/* corner badge */}
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="size-3 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="text-[10px] font-medium text-foreground">AI</span>
          </div>
        </div>

        {/* Prompt bar */}
        <div className="flex items-center gap-2 border-t border-border bg-[oklch(0.15_0.006_265)] px-4 py-3">
          <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
          <span className="flex-1 truncate font-mono text-[12px] text-muted-foreground">
            Cinematic drone intro, golden hour, 4K...
          </span>
          <button className="shrink-0 rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90">
            Generate
          </button>
        </div>
      </div>

      {/* Output thumbnails */}
      <div className="grid grid-cols-4 gap-2">
        {OUTPUTS.map((o, i) => (
          <button
            key={o.label}
            onClick={() => setActive(i)}
            className={`group relative flex flex-col overflow-hidden rounded-lg border transition-all ${
              active === i
                ? "border-primary/60 shadow-[0_0_12px_oklch(0.72_0.14_285/0.25)]"
                : "border-border hover:border-border/80"
            }`}
          >
            {/* mini preview */}
            <div
              className="relative aspect-video w-full"
              style={{ background: `oklch(0.14 0.01 ${o.hue})` }}
            >
              <div
                className="absolute bottom-0 left-0 h-1 transition-all"
                style={{
                  width: o.w,
                  background: `oklch(0.72 0.15 ${o.hue})`,
                  boxShadow: `0 0 6px oklch(0.72 0.15 ${o.hue} / 0.6)`,
                }}
              />
              {active === i && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <PlayIcon className="size-4" style={{ color: `oklch(0.82 0.14 ${o.hue})` }} />
                </div>
              )}
            </div>
            <div className="bg-card px-2 py-1.5">
              <p className="truncate text-[10px] text-muted-foreground">{o.label}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/20">
      <div className="mb-4 grid size-9 place-items-center rounded-md border border-border bg-background text-foreground/80 transition-colors group-hover:text-foreground">
        {icon}
      </div>
      <h3 className="text-[14px] font-semibold leading-snug tracking-tight text-foreground">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

export function StepCard({
  number,
  icon,
  title,
  description,
}: {
  number: string
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="relative mx-auto mb-4 grid size-12 place-items-center rounded-lg border border-border bg-card">
        {icon}
        <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full border border-border bg-foreground text-[10px] font-semibold text-background">
          {number}
        </span>
      </div>
      <h3 className="text-[14px] font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

export function TestimonialCard({
  stars,
  quote,
  name,
  role,
}: {
  stars: number
  quote: string
  name: string
  role: string
}) {
  return (
    <figure className="flex h-full flex-col rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex gap-0.5 text-foreground/70">
        {Array.from({ length: stars }).map((_, i) => (
          <svg key={i} viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
      <blockquote className="flex-1 text-[14px] leading-relaxed text-foreground/90">
        “{quote}”
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
        <div className="grid size-8 place-items-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
          {name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
        </div>
        <div>
          <p className="text-[13px] font-medium text-foreground">{name}</p>
          <p className="text-[11px] text-muted-foreground">{role}</p>
        </div>
      </figcaption>
    </figure>
  )
}
