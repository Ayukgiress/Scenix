import { useState } from "react"

const faqs = [
  {
    q: "Can I cancel my subscription at any time?",
    a: "Yes. You can cancel, downgrade, or upgrade from your account dashboard at any moment. No contracts, no fine print.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit and debit cards, plus PayPal and Apple Pay in supported regions.",
  },
  {
    q: "Is there a free trial for paid plans?",
    a: "Yes. Every paid plan comes with a 14-day free trial — no credit card required to start.",
  },
  {
    q: "Can I switch between monthly and annual billing?",
    a: "Absolutely. You can change your billing cycle at any time. Annual plans save you 20%.",
  },
  {
    q: "Do you offer refunds on your paid plans?",
    a: "We offer a 30-day money-back guarantee on all paid plans. If you're not happy, we'll refund you.",
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="mx-auto w-full max-w-3xl divide-y divide-border rounded-xl border border-border bg-card/40">
      {faqs.map((f, i) => {
        const isOpen = open === i
        return (
          <div key={f.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
            >
              <span className="text-[14px] font-medium text-foreground">{f.q}</span>
              <svg
                viewBox="0 0 24 24"
                className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {isOpen && (
              <div className="px-5 pb-4 text-[13px] leading-relaxed text-muted-foreground">{f.a}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
