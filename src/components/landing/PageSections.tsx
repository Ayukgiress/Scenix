import { useState } from "react"
import { Button } from "@/components/ui/button"
import { StepCard, TestimonialCard } from "@/components/landing/EditorPreview"
import { PricingCard } from "@/components/pricing/PricingCard"
import { FAQ } from "@/components/pricing/FAQ"
import { Link } from "react-router-dom"

const steps = [
  {
    number: "1",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="6 3 20 12 6 21 6 3" />
      </svg>
    ),
    title: "Import",
    description: "Drop in footage from anywhere. Cloud sync keeps your projects ready across devices.",
  },
  {
    number: "2",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" />
        <line x1="14.47" y1="14.48" x2="20" y2="20" />
      </svg>
    ),
    title: "Edit",
    description: "Trim, layer, and refine on a buttery-smooth multi-track timeline built for precision.",
  },
  {
    number: "3",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    title: "Export",
    description: "Render in 4K and publish to your channel — all from the browser.",
  },
]

const testimonials = [
  {
    stars: 5,
    quote: "Scenix replaced my desktop editor. The browser-based workflow is faster, the cloud rendering is rock solid, and I haven't missed an export deadline in months.",
    name: "Maya Reyes",
    role: "Filmmaker & Creator",
  },
  {
    stars: 5,
    quote: "We moved our 12-person video team to Scenix in a weekend. The collaboration features and shared libraries are exactly what we needed.",
    name: "Devon Tanaka",
    role: "Head of Content, Lumen",
  },
  {
    stars: 5,
    quote: "The multi-track timeline and audio tools feel pro without the learning curve. I shipped my first long-form piece in a day.",
    name: "Priya Sundaram",
    role: "Podcast Producer",
  },
]

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "/month",
    description: "Everything you need to start editing and publishing.",
    cta: "Get started",
    features: [
      "Up to 5 video projects",
      "1080p exports",
      "Multi-track timeline",
      "Watermark on exports",
      "Community support",
    ],
  },
  {
    name: "Pro",
    price: "$12",
    cadence: "/month",
    description: "For creators shipping professional work, every week.",
    cta: "Start 14-day trial",
    badge: "Most popular",
    highlighted: true,
    features: [
      "Unlimited projects",
      "4K Ultra HD exports",
      "No watermark",
      "Advanced effects & motion",
      "100+ royalty-free tracks",
      "AI cleanup tools",
      "Priority support",
    ],
  },
  {
    name: "Team",
    price: "$30",
    cadence: "/user/month",
    description: "Built for teams that need to move fast, together.",
    cta: "Contact sales",
    features: [
      "Up to 8K ProRes exports",
      "Real-time collaboration",
      "Brand kits & templates",
      "Shared media libraries",
      "Roles & access controls",
      "Advanced team analytics",
      "Dedicated account manager",
    ],
  },
]

export function StepsSection() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto w-full max-w-5xl px-5">
        <div className="text-center">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Workflow</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground md:text-[36px]">
            From raw footage to final cut
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[14px] text-muted-foreground">
            A focused three-step workflow that gets out of your way.
          </p>
        </div>
        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <StepCard key={s.number} number={s.number} icon={s.icon} title={s.title} description={s.description} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function TestimonialsSection() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto w-full max-w-7xl px-5">
        <div className="text-center">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Testimonials</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground md:text-[36px]">
            Trusted by creators and teams
          </h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <TestimonialCard key={t.name} stars={t.stars} quote={t.quote} name={t.name} role={t.role} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function PricingSection() {
  const [annual, setAnnual] = useState(false)
  
  const getPrice = (monthlyPrice: string) => {
    if (monthlyPrice === "$0") return "$0"
    const price = parseInt(monthlyPrice.replace("$", ""))
    return annual ? `$${Math.floor(price * 12 * 0.8)}` : monthlyPrice
  }
  
  const getCadence = (baseCadence: string) => {
    if (baseCadence.includes("user")) {
      return annual ? "/user/year" : baseCadence
    }
    return annual ? "/year" : baseCadence
  }
  return (
    <section id="pricing" className="border-t border-border py-24">
      <div className="mx-auto w-full max-w-7xl px-5">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Pricing</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground md:text-[36px]">
            Simple plans for every creator
          </h2>
          <p className="mt-3 text-[14px] text-muted-foreground">
            Start for free. Upgrade when you need more power. Cancel anytime.
          </p>
          <div className="mt-6 inline-flex items-center gap-0.5 rounded-md border border-border bg-card/40 p-0.5 text-[12px]">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded px-3 py-1 transition-colors ${
                !annual ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-1.5 rounded px-3 py-1 transition-colors ${
                annual ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="rounded-sm bg-foreground/10 px-1 py-0.5 text-[10px] font-medium text-foreground">
                −20%
              </span>
            </button>
          </div>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {tiers.map((t) => (
            <PricingCard 
              key={t.name} 
              {...t} 
              price={getPrice(t.price)}
              cadence={getCadence(t.cadence || "")}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export function FaqSection() {
  return (
    <section id="faq" className="border-t border-border py-24">
      <div className="mx-auto w-full max-w-7xl px-5">
        <div className="mb-10 text-center">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">FAQ</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground md:text-[36px]">
            Questions, answered
          </h2>
        </div>
        <FAQ />
      </div>
    </section>
  )
}

export function CtaSection() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto w-full max-w-2xl px-5 text-center">
        <h2 className="text-[28px] font-semibold tracking-tight text-foreground md:text-[36px]">
          Start creating in minutes
        </h2>
        <p className="mt-3 text-[14px] text-muted-foreground">
          No downloads. No credit card. Just open your browser and start editing.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button size="lg" asChild>
            <Link to="/editor">Open the editor</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#pricing">See pricing</a>
          </Button>
        </div>
      </div>
    </section>
  )
}

export function UseCasesSection() {
  const useCases = [
    {
      title: "Content Creators",
      description: "Edit vlogs, tutorials, and social content with studio-grade tools. Export vertical videos optimized for TikTok, Reels, and Shorts.",
      icon: (
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m22 8-6 4 6 4V8Z" />
          <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
        </svg>
      ),
    },
    {
      title: "Marketing Teams",
      description: "Collaborate on campaigns, share brand assets, and ship ads faster. Version control and comments keep everyone aligned.",
      icon: (
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.5 16.5h7" />
          <path d="M12.5 20.5h7" />
          <circle cx="5" cy="18.5" r="2.5" />
          <path d="M12 6V3" />
          <path d="m7 6 5-5 5 5" />
        </svg>
      ),
    },
    {
      title: "Educators",
      description: "Create engaging lessons, screen recordings, and course content. Add captions, annotations, and interactive elements.",
      icon: (
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      ),
    },
    {
      title: "Podcasters",
      description: "Visualize audio with waveforms, trim silence, and add dynamic captions. Export highlight clips for promotion.",
      icon: (
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      ),
    },
  ]

  return (
    <section className="border-t border-border py-24 bg-muted/20">
      <div className="mx-auto w-full max-w-7xl px-5">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Use Cases</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground md:text-[36px]">
            Built for every creator
          </h2>
          <p className="mt-3 text-[14px] text-muted-foreground">
            Whether you're a solo creator or a team, Scenix adapts to your workflow.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((uc) => (
            <div key={uc.title} className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-foreground/20">
              <div className="mb-4 text-primary">{uc.icon}</div>
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{uc.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{uc.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function StatsSection() {
  const stats = [
    { value: "10M+", label: "Videos Exported" },
    { value: "50K+", label: "Active Creators" },
    { value: "4.9/5", label: "User Rating" },
    { value: "99.9%", label: "Uptime" },
  ]

  return (
    <section className="border-t border-border py-20 bg-card/40">
      <div className="mx-auto w-full max-w-7xl px-5">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-[42px] font-semibold tracking-tight text-foreground">{stat.value}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ComparisonSection() {
  const features = [
    { name: "No installation required", scenix: true, traditional: false },
    { name: "Works on any device", scenix: true, traditional: false },
    { name: "Cloud rendering", scenix: true, traditional: false },
    { name: "Real-time collaboration", scenix: true, traditional: false },
    { name: "Auto-save & version history", scenix: true, traditional: false },
    { name: "4K 60fps export", scenix: true, traditional: true },
    { name: "Multi-track timeline", scenix: true, traditional: true },
    { name: "AI-powered tools", scenix: true, traditional: false },
  ]

  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto w-full max-w-4xl px-5">
        <div className="text-center">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Comparison</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground md:text-[36px]">
            Why choose Scenix?
          </h2>
          <p className="mt-3 text-[14px] text-muted-foreground">
            Modern workflow meets professional power.
          </p>
        </div>
        <div className="mt-12 overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border bg-muted/40 px-6 py-4 text-[13px] font-medium">
            <div className="text-foreground">Feature</div>
            <div className="text-center text-foreground">Scenix</div>
            <div className="text-center text-muted-foreground">Traditional</div>
          </div>
          {features.map((feature, i) => (
            <div
              key={feature.name}
              className={`grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-4 text-[13px] ${
                i !== features.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="text-foreground/90">{feature.name}</div>
              <div className="flex justify-center">
                {feature.scenix ? (
                  <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="size-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>
              <div className="flex justify-center">
                {feature.traditional ? (
                  <svg viewBox="0 0 24 24" className="size-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="size-4 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
