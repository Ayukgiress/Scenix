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
                <span className="text-foreground">Create. Edit. Generate.</span>
                <br />
                <span className="hero-shimmer-text">Powered by AI.</span>
              </h1>

              {/* Sub */}
              <p
                className="hero-fade-up mt-6 max-w-lg text-[17px] leading-relaxed text-muted-foreground"
                style={{ animationDelay: "160ms" }}
              >
                The browser-native studio that thinks with you. Generate footage, edit on a
                multi-track timeline, and export in 4K — no installs required.
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
                  Start creating free
                </Link>
                <a
                  href="#features"
                  className="inline-flex h-12 items-center rounded-lg border border-border px-8 text-[14px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  See features
                </a>
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
