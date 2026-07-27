import { Button } from "@/components/ui/button"
import { Link, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"

const sections = [
  { id: "features", label: "Features" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
] as const

export function Topbar() {
  const { pathname } = useLocation()
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (pathname !== "/") return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActiveId(visible.target.id)
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    )
    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-6 px-5">
        <Link to="/" className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-foreground">
          <span className="grid size-7 place-items-center rounded-md bg-foreground text-background">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m10 9 5 3-5 3z" fill="currentColor" />
            </svg>
          </span>
          Scenix
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {sections.map((item) => (
            <a
              key={item.id}
              href={`/#${item.id}`}
              onClick={() => setActiveId(item.id)}
              className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                activeId === item.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/editor"
            className="rounded-md px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Editor
          </Link>
        </nav>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="text-[13px]" asChild>
            <Link to="/login">Log in</Link>
          </Button>
          <Button size="sm" className="text-[13px] font-medium" asChild>
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
