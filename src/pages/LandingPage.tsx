// import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { useTypewriter } from "@/hooks/useTypewriter"
import { HeroBg } from "@/components/landing/HeroBg"
import { EditorPreview, FeatureCard } from "@/components/landing/EditorPreview"
import {
  StepsSection,
  TestimonialsSection,
  PricingSection,
  FaqSection,
  CtaSection,
} from "@/components/landing/PageSections"

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="6 3 20 12 6 21 6 3" />
      </svg>
    ),
    title: "Cloud Rendering",
    description: "Process and export videos in the cloud, so playback stays smooth on any device.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
      </svg>
    ),
    title: "Smart Trim",
    description: "Auto-detect cuts and silence. Generate a clean timeline in seconds.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 3v18" />
      </svg>
    ),
    title: "Multi-Track Timeline",
    description: "Layer audio, video, and effects with the precision of a professional NLE.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 10v3" />
        <path d="M6 6v11" />
        <path d="M10 3v18" />
        <path d="M14 8v7" />
        <path d="M18 5v14" />
        <path d="M22 10v3" />
      </svg>
    ),
    title: "Studio Audio",
    description: "AI noise reduction, EQ presets, and a royalty-free music library.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    title: "4K 60fps Export",
    description: "Render up to 4K at 60fps from your browser — no installs, no waiting.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Team Collaboration",
    description: "Comment, review, and ship together with shared libraries and version history.",
  },
]

const AI_PROMPTS = [
  "Generate a cinematic drone intro, golden hour...",
  "Remove background noise and enhance vocals...",
  "Auto-cut to beat — apply cinematic LUT...",
  "Upscale to 4K and stabilise shaky footage...",
  "Generate B-roll from script: urban timelapse...",
]

export function LandingPage() {
  const prompt = useTypewriter(AI_PROMPTS)

  return (
    <>
      <section className="relative flex min-h-screen items-center overflow-hidden bg-background">
        {/* Animated canvas bg */}
        <HeroBg />

        {/* Scan line sweep */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[2px] opacity-20"
          style={{
            background: "linear-gradient(90deg, transparent, oklch(0.72 0.14 285), transparent)",
            animation: "scan-line 8s linear infinite",
          }}
        />

        {/* Bottom gradient fade into page */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
          style={{ background: "linear-gradient(to bottom, transparent, oklch(0.16 0.005 260))" }}
        />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 py-24 md:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">

            {/* ── Left: copy ── */}
            <div>
              {/* Badge */}
              <div
                className="hero-fade-in inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur-sm"
                style={{ animationDelay: "0ms" }}
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                AI-powered · Now in public beta
              </div>

              {/* Headline */}
              <h1
                className="hero-fade-up mt-6 text-balance text-[42px] font-semibold leading-[1.04] tracking-tight md:text-[58px]"
                style={{ animationDelay: "80ms" }}
              >
                <span className="text-foreground">Create. Edit. Generate.</span>
                <br />
                <span className="hero-shimmer-text">Powered by AI.</span>
              </h1>

              {/* Sub */}
              <p
                className="hero-fade-up mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground"
                style={{ animationDelay: "160ms" }}
              >
                The browser-native studio that thinks with you. Generate footage, edit on a
                multi-track timeline, and export in 4K — no installs required.
              </p>

              {/* CTAs */}
              <div
                className="hero-fade-up mt-8 flex flex-wrap items-center gap-3"
                style={{ animationDelay: "220ms" }}
              >
                <Link
                  to="/signup"
                  className="group relative inline-flex h-11 items-center overflow-hidden rounded-md bg-primary px-6 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                  />
                  Start creating free
                </Link>
                <a
                  href="#features"
                  className="inline-flex h-11 items-center rounded-md border border-border px-6 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  See features
                </a>
              </div>

              {/* AI prompt bar */}
              <div
                className="hero-fade-up mt-8 flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3 backdrop-blur-sm"
                style={{ animationDelay: "300ms" }}
              >
                <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z" />
                  <path d="M12 8v4l3 3" />
                </svg>
                <span className="flex-1 truncate font-mono text-[12px] text-muted-foreground">
                  {prompt}
                  <span className="cursor-blink ml-0.5 inline-block w-[2px] translate-y-[1px] bg-primary align-middle" style={{ height: "1em" }} />
                </span>
                <span className="shrink-0 rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground">AI</span>
              </div>

              {/* Stats */}
              <div
                className="hero-fade-up mt-8 flex items-center gap-8 border-t border-border pt-8"
                style={{ animationDelay: "380ms" }}
              >
                {([["10K+", "creators"], ["4K 60fps", "export"], ["0", "installs"]] as const).map(([val, label]) => (
                  <div key={label}>
                    <p className="text-[22px] font-semibold tracking-tight text-foreground">{val}</p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: editor preview ── */}
            <div
              id="editor"
              className="hero-fade-up"
              style={{ animationDelay: "120ms" }}
            >
              {/* Glow behind preview */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-10 -z-10 blur-3xl"
                style={{ background: "radial-gradient(60% 60% at 50% 50%, oklch(0.72 0.14 285 / 0.12), transparent 80%)" }}
              />
              <EditorPreview />
            </div>

          </div>
        </div>
      </section>

      <section id="features" className="border-t border-border py-24">
        <div className="mx-auto w-full max-w-7xl px-5">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Features</p>
            <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground md:text-[36px]">
              Everything you need to ship
            </h2>
            <p className="mt-3 text-[14px] text-muted-foreground">
              A focused, professional toolset — no clutter, no learning curve.
            </p>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
            ))}
          </div>
        </div>
      </section>

      <StepsSection />
      <TestimonialsSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
    </>
  )
}
