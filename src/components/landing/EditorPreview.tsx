import { useEffect, useRef } from "react"
import type { ReactNode } from "react"

// ─── Clip data — using smaller test videos for guaranteed loading ────────────

const CLIPS = [
  {
    label: "Cinematic drone intro",
    tag: "AI Generated",
    hue: 285,
    aspect: "aspect-video",
    src: "/12779446_3840_2160_24fps.mp4",
  },
  {
    label: "Beat sync cut",
    tag: "Auto Edit",
    hue: 200,
    aspect: "aspect-video",
    src: "/15488611_1920_1080_30fps.mp4",
  },
  {
    label: "AI Forest scene",
    tag: "AI Generated",
    hue: 170,
    aspect: "aspect-video",
    src: "/AI-Generated Blockbuster Scene_ _The Forest of Giants Awakens_ (Sora 2).mp4",
  },
  {
    label: "Creative content",
    tag: "4K Export",
    hue: 300,
    aspect: "aspect-video",
    src: "/Cute or Creepy_ AI Fruit Babies Eating Real Fruit🍓👶_ The Ultimate Oddly Satisfying AI ASMR.mp4",
  },
  {
    label: "Podcast highlight reel",
    tag: "Auto Edit",
    hue: 60,
    aspect: "aspect-video",
    src: "/videoplayback.mp4",
  },
  {
    label: "Brand identity video",
    tag: "4K Export",
    hue: 20,
    aspect: "aspect-video",
    src: "/12779446_3840_2160_24fps.mp4",
  },
  {
    label: "Studio audio mix",
    tag: "Studio Audio",
    hue: 140,
    aspect: "aspect-video",
    src: "/15488611_1920_1080_30fps.mp4",
  },
  {
    label: "AI-powered editing",
    tag: "AI Generated",
    hue: 260,
    aspect: "aspect-video",
    src: "/videoplayback.mp4",
  },
]

// ─── Single video clip card ───────────────────────────────────────────────────

function ClipCard({ label, tag, hue, aspect, src }: typeof CLIPS[0]) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    
    v.muted = true
    v.playsInline = true
    v.loop = true
    v.defaultMuted = true
    v.volume = 0
    
    const playPromise = v.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const tryPlay = () => {
          v.play().catch(() => {})
          document.removeEventListener('click', tryPlay)
        }
        document.addEventListener('click', tryPlay, { once: true })
      })
    }
  }, [src])

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.12]">
      <div className={`relative w-full ${aspect}`}>
        <video
          ref={videoRef}
          src={src}
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
      </div>
    </div>
  )
}

// ─── Scrolling column ─────────────────────────────────────────────────────────

function ScrollColumn({ clips, duration, delay = 0 }: { clips: typeof CLIPS; duration: number; delay?: number }) {
  return (
    <div
      className="flex flex-col gap-3 overflow-hidden"
      style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)" }}
    >
      <div
        className="flex flex-col gap-3"
        style={{
          animation: `scroll-up ${duration}s linear infinite`,
          animationDelay: `${delay}s`,
        }}
      >
        {[...clips, ...clips].map((clip, i) => (
          <ClipCard key={i} {...clip} />
        ))}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function EditorPreview() {
  return (
    <div className="relative h-[580px] overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-black/20 via-black/10 to-black/20 backdrop-blur-xl">
      {/* Editor window title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-black/30">
        <div className="flex gap-1.5">
          <span className="size-3 rounded-full bg-red-500/80"></span>
          <span className="size-3 rounded-full bg-yellow-500/80"></span>
          <span className="size-3 rounded-full bg-green-500/80"></span>
        </div>
        <span className="ml-4 text-xs text-white/60">Scenix Video Editor - My Project.scx</span>
      </div>
      
      {/* Editor interface screenshot */}
      <div className="relative h-[calc(100%-44px)] w-full">
        <img 
          src="/src/assets/hero.png" 
          alt="Scenix Video Editor interface showing timeline, preview monitor, and editing panels"
          className="w-full h-full object-cover"
        />
        {/* Overlay highlight for key editor features */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          <span className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white/90">Multi-track Timeline</span>
          <span className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white/90">Preview Monitor</span>
          <span className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white/90">Media Library</span>
        </div>
      </div>
      
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.05]" />
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