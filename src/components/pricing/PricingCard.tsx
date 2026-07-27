import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

export type PricingCardProps = {
  name: string
  price: string
  cadence?: string
  description: string
  features: string[]
  cta: string
  highlighted?: boolean
  badge?: string
}

export function PricingCard({
  name,
  price,
  cadence,
  description,
  features,
  cta,
  highlighted = false,
  badge,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 ${
        highlighted
          ? "border-foreground/15 bg-card shadow-[0_0_0_1px_oklch(0.72_0.14_285_/_0.25)]"
          : "border-border bg-card/40"
      }`}
    >
      {badge && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-foreground/10 bg-foreground px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background">
          {badge}
        </span>
      )}
      <h3 className="text-[14px] font-semibold text-foreground">{name}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-[40px] font-semibold leading-none tracking-tight text-foreground">{price}</span>
        {cadence && <span className="text-[13px] text-muted-foreground">{cadence}</span>}
      </div>
      <Button variant={highlighted ? "default" : "outline"} className="mt-5 w-full" asChild>
        <a href="#">{cta}</a>
      </Button>
      <ul className="mt-6 space-y-2.5 text-[13px] text-foreground/85">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <svg viewBox="0 0 24 24" className="mt-0.5 size-3.5 shrink-0 text-foreground/70" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PricingHeader({ children }: { children: ReactNode }) {
  return <>{children}</>
}
