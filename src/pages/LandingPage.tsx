// import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { HeroBg } from "@/components/landing/HeroBg"
import { EditorPreview, FeatureCard } from "@/components/landing/EditorPreview"
import {
  StepsSection,
  TestimonialsSection,
  PricingSection,
  FaqSection,
  CtaSection,
  UseCasesSection,
  StatsSection,
  ComparisonSection,
} from "@/components/landing/PageSections"

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 3v18" />
      </svg>
    ),
    title: "Professional Multi-Track Timeline",
    description: "Layer unlimited video, audio, and text tracks with the precision of desktop NLE software.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: "Precision Editing Tools",
    description: "Cut, trim, split, ripple delete, and arrange clips with frame-accurate precision.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
    title: "Keyframe Animation",
    description: "Animate position, scale, opacity, and effects for professional motion graphics.",
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
    title: "Studio Audio Tools",
    description: "AI noise reduction, EQ presets, audio mixing, and royalty-free music library.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    title: "Cloud Rendering & 4K Export",
    description: "Render up to 4K 60fps in the cloud so your editing stays smooth. No local GPU required.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
      </svg>
    ),
    title: "AI Smart Features",
    description: "Auto-detect cuts and silence, generate captions, and clean up audio with AI.",
  },
]

export function LandingPage() {

  return (
    <>
      <section className="relative flex min-h-screen items-center overflow-hidden bg-background">
        {/* Animated canvas bg */}
        <HeroBg />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{ background: "linear-gradient(to bottom, transparent, oklch(0.16 0.005 260))" }}
        />

        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-20 md:py-28">
          <div className="grid items-center gap-16 lg:grid-cols-[1fr_600px] lg:gap-20">

            {/* ── Left: copy ── */}
            <div className="max-w-2xl">
              {/* Badge */}
              <div
                className="hero-fade-in inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur-sm"
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
                className="hero-fade-up mt-8 text-balance text-[48px] font-semibold leading-[1.06] tracking-tight md:text-[64px]"
                style={{ animationDelay: "80ms" }}
              >
                <span className="text-foreground">Professional</span>
                <br />
                <span className="hero-shimmer-text">Video Editing</span>
                <br />
                <span className="text-foreground">in your browser</span>
              </h1>

              {/* Sub */}
              <p
                className="hero-fade-up mt-6 max-w-lg text-[17px] leading-relaxed text-muted-foreground"
                style={{ animationDelay: "160ms" }}
              >
                Edit videos with a professional multi-track timeline, AI-powered tools, and cloud rendering. Get the power of desktop editing software without the installs or learning curve.
              </p>

              {/* CTAs */}
              <div
                className="hero-fade-up mt-10 flex flex-wrap items-center gap-4"
                style={{ animationDelay: "220ms" }}
              >
                <Link
                  to="/signup"
                  className="group relative inline-flex h-12 items-center overflow-hidden rounded-lg bg-primary px-8 text-[14px] font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                  />
                  Start Editing Free
                </Link>
                <Link
                  to="/editor"
                  className="inline-flex h-12 items-center rounded-lg border border-border px-8 text-[14px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Try the Editor
                </Link>
              </div>

              {/* Stats */}
              <div
                className="hero-fade-up mt-12 flex items-center gap-10 border-t border-border/50 pt-8"
                style={{ animationDelay: "300ms" }}
              >
                {([["10K+", "creators"], ["4K 60fps", "export"], ["Zero", "installs"]] as const).map(([val, label]) => (
                  <div key={label}>
                    <p className="text-[26px] font-semibold tracking-tight text-foreground">{val}</p>
                    <p className="text-[12px] uppercase tracking-wider text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="hero-fade-up relative"
              style={{ animationDelay: "120ms" }}
            >
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
      <UseCasesSection />
      <StatsSection />
      <TestimonialsSection />
      <ComparisonSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
    </>
  )
}