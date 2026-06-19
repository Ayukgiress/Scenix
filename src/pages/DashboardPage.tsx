import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner"
import { useDashboardStore } from "@/store/dashboardStore"
import { realtimeService } from "@/services/realtimeService"
import type { Project } from "@/types/dashboard"

const NAV = [
  { label: "Home",     icon: "home",    path: "/dashboard" },
  { label: "Projects", icon: "grid",    path: "/dashboard" },
  { label: "Media",    icon: "file",    path: "/media" },
  { label: "Exports",  icon: "export",  path: "/exports" },
  { label: "Team",     icon: "team",    path: "/dashboard" },
  { label: "Settings", icon: "settings",path: "/dashboard" },
]

// ─── Icons ────────────────────────────────────────────────────────────────────

function Icon({ name, className = "size-4" }: { name: string; className?: string }) {
  const props = { viewBox: "0 0 24 24", className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (name) {
    case "file":     return <svg {...props}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
    case "home":     return <svg {...props}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
    case "grid":     return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
    case "ai":       return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
    case "export":   return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    case "team":     return <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    case "settings": return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    case "edit":     return <svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    case "share":    return <svg {...props}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
    case "plus":     return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    case "dots":     return <svg {...props}><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>
    case "play":     return <svg {...props}><polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/></svg>
    case "search":   return <svg {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    case "bell":     return <svg {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    case "logout":   return <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    default:         return null
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    exported:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    rendering:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
    draft:      "bg-muted text-muted-foreground border-border",
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${map[status] ?? map.draft}`}>
      {status}
    </span>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-border/80 hover:shadow-[0_8px_32px_oklch(0_0_0/0.4)]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-video w-full overflow-hidden"
        style={{ background: `linear-gradient(135deg, oklch(0.18 0.06 ${project.thumb[0]}), oklch(0.26 0.1 ${project.thumb[1]}))` }}
      >
        {/* fake scanlines */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, oklch(0 0 0 / 0.3) 3px, oklch(0 0 0 / 0.3) 4px)" }} />
        {/* duration badge */}
        <span className="absolute bottom-2 right-2 rounded bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-foreground backdrop-blur-sm">
          {project.duration}
        </span>
        {/* hover overlay */}
        <div className={`absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm transition-opacity duration-200 ${hover ? "opacity-100" : "opacity-0"}`}>
          <Link
            to="/editor"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
          >
            <Icon name="play" className="size-3" />
            Open editor
          </Link>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[13px] font-medium text-foreground">{project.title}</p>
          <button className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground">
            <Icon name="dots" className="size-4" />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <StatusBadge status={project.status} />
          <span className="text-[11px] text-muted-foreground">{project.size}</span>
        </div>
        {/* Progress bar for rendering/processing */}
        {(project.status === "rendering" || project.status === "processing") && project.progress !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{project.status === "rendering" ? "Rendering" : "Processing"}...</span>
              <span className="font-mono text-foreground">{project.progress}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Updated {project.updatedAt}</p>
      </div>
    </div>
  )
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const [activeNav, setActiveNav] = useState("Projects")
  const [filter, setFilter] = useState<"all" | "exported" | "processing" | "rendering" | "draft">("all")
  const [search, setSearch] = useState("")
  const { user, logout, accessToken } = useAuth()

  const {
    projects,
    activities,
    stats,
    loading,
    error,
    fetchProjects,
    fetchMedia,
    fetchExports,
    createProject,
    setError
  } = useDashboardStore()

  // Fetch data on mount
  useEffect(() => {
    if (accessToken) {
      fetchProjects(accessToken)
      fetchMedia(accessToken)
      fetchExports(accessToken)
    }
  }, [accessToken, fetchProjects, fetchMedia, fetchExports])

  // Start real-time updates
  useEffect(() => {
    realtimeService.start()
    return () => realtimeService.stop()
  }, [])

  const handleCreateProject = async () => {
    if (!accessToken) return
    const title = prompt('Project name:')
    if (title?.trim()) {
      await createProject(accessToken, title.trim())
    }
  }

  const emailVerified = (user as any)?.emailVerified ?? true

  const filtered = projects.filter((p) => {
    const matchFilter = filter === "all" || p.status === filter
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div className="flex h-screen bg-background text-foreground">

      {/* ── Sidebar ── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/40">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Link to="/" className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-foreground text-background">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m10 9 5 3-5 3z" fill="currentColor" />
              </svg>
            </span>
            Scenix
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              onClick={() => setActiveNav(item.label)}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${
                activeNav === item.label
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon name={item.icon} className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-foreground">{user?.name ?? "User"}</p>
              <p className="truncate text-[10px] text-muted-foreground">Free plan</p>
            </div>
            <button onClick={() => logout()} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
              <Icon name="logout" className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Email verification banner */}
        {!emailVerified && user?.email && <EmailVerificationBanner email={user.email} />}

        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <div>
            <h1 className="text-[15px] font-semibold text-foreground">Dashboard</h1>
            <p className="text-[12px] text-muted-foreground">Welcome back, {user?.name?.split(" ")[0] ?? "there"} 👋</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Icon name="search" className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-52 rounded-md border border-border bg-card pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button className="relative grid size-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground">
              <Icon name="bell" className="size-4" />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
            </button>
            <Link
              to="/editor"
              className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Icon name="plus" className="size-3.5" />
              New project
            </Link>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-auto max-w-7xl p-6">
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-red-400">
                <p className="text-sm">{error}</p>
                <button 
                  onClick={() => setError(null)} 
                  className="mt-2 text-xs underline hover:no-underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          
          <div className="mx-auto max-w-7xl space-y-8 p-6">

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total projects</p>
                <p className="mt-1.5 text-[26px] font-semibold tracking-tight text-foreground">{stats.totalProjects}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">+2 this month</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Storage used</p>
                <p className="mt-1.5 text-[26px] font-semibold tracking-tight text-foreground">{stats.storageUsed} GB</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">of {stats.storageTotal} GB free</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Exports</p>
                <p className="mt-1.5 text-[26px] font-semibold tracking-tight text-foreground">{stats.exports}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">+8 this month</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">AI generations</p>
                <p className="mt-1.5 text-[26px] font-semibold tracking-tight text-foreground">{stats.aiGenerations}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">+12 this month</p>
              </div>
            </div>

            {/* Storage bar */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-foreground">Storage</p>
                <p className="text-[12px] text-muted-foreground">{stats.storageUsed} GB <span className="text-muted-foreground/50">/ {stats.storageTotal} GB</span></p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(stats.storageUsed / stats.storageTotal) * 100}%`, background: "linear-gradient(90deg, oklch(0.72 0.14 285), oklch(0.65 0.15 220))" }}
                />
              </div>
              <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span><span className="mr-1 inline-block size-2 rounded-full bg-primary align-middle" />Video — 14.2 GB</span>
                <span><span className="mr-1 inline-block size-2 rounded-full bg-blue-400 align-middle" />Audio — 1.8 GB</span>
                <span><span className="mr-1 inline-block size-2 rounded-full bg-muted-foreground align-middle" />Free — 33.5 GB</span>
              </div>
            </div>

            {/* Projects + Activity side by side */}
            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

              {/* Projects */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[14px] font-semibold text-foreground">Recent projects</h2>
                  {/* Filter pills */}
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 text-[11px]">
                    {(["all", "exported", "processing", "rendering", "draft"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                          filter === f ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
                    <Icon name="grid" className="mb-2 size-8 opacity-30" />
                    <p className="text-[13px]">No projects found</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
                    {/* New project card */}
                    <button
                      onClick={handleCreateProject}
                      className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/40 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <span className="grid size-10 place-items-center rounded-full border border-border">
                        <Icon name="plus" className="size-5" />
                      </span>
                      <span className="text-[12px]">New project</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Activity feed */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[14px] font-semibold text-foreground">Activity</h2>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <div className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Live
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card">
                  {activities.slice(0, 6).map((a, i) => (
                    <div
                      key={a.id}
                      className={`flex items-start gap-3 px-4 py-3 ${i < Math.min(activities.length, 6) - 1 ? "border-b border-border" : ""}`}
                    >
                      <div className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border ${
                        a.icon === "export" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" :
                        a.icon === "ai"     ? "border-primary/20 bg-primary/10 text-primary" :
                        "border-border bg-muted text-muted-foreground"
                      }`}>
                        <Icon name={a.icon} className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] leading-snug text-foreground">{a.text}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{a.time}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                <h2 className="mb-3 mt-6 text-[14px] font-semibold text-foreground">Quick actions</h2>
                <div className="flex flex-col gap-2">
                  {[
                    { icon: "ai",     label: "Generate with AI",   sub: "Text to video" },
                    { icon: "edit",   label: "Open editor",         sub: "Start a new cut" },
                    { icon: "export", label: "Export last project", sub: "Brand Reel 2025" },
                  ].map((q) => (
                    <Link
                      key={q.label}
                      to="/editor"
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-border/80 hover:bg-muted/40"
                    >
                      <div className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-background text-muted-foreground">
                        <Icon name={q.icon} className="size-4" />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-foreground">{q.label}</p>
                        <p className="text-[11px] text-muted-foreground">{q.sub}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
