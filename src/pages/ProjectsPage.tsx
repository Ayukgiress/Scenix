import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { api, Project as APIProject } from "@/lib/api"
import { DashboardLayout } from "@/layouts/DashboardLayout"

function Icon({ name, className = "size-4" }: { name: string; className?: string }) {
  const props = { viewBox: "0 0 24 24", className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (name) {
    case "plus": return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    case "play": return <svg {...props}><polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/></svg>
    case "edit": return <svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    case "trash": return <svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    case "dots": return <svg {...props}><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>
    case "search": return <svg {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    case "grid": return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
    default: return null
  }
}

interface Project extends APIProject {
  hue: number
  thumb: [number, number]
  duration: string
  size: string
}

function timeAgo(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHrs / 24)
  
  if (diffHrs < 1) return 'Just now'
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    exported: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    rendering: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    draft: "bg-muted text-muted-foreground border-border",
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${map[status] ?? map.draft}`}>
      {status}
    </span>
  )
}

function ProjectCard({ project, onEdit, onDelete }: { project: Project; onEdit: (project: Project) => void; onDelete: (id: string) => void }) {
  const [hover, setHover] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-border/80 hover:shadow-[0_8px_32px_oklch(0_0_0/0.4)]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-video w-full overflow-hidden"
        style={{ background: `linear-gradient(135deg, oklch(0.18 0.06 ${project.thumb[0]}), oklch(0.26 0.1 ${project.thumb[1]}))` }}
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, oklch(0 0 0 / 0.3) 3px, oklch(0 0 0 / 0.3) 4px)" }} />
        <span className="absolute bottom-2 right-2 rounded bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-foreground backdrop-blur-sm">
          {project.duration}
        </span>
        <div className={`absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm transition-opacity duration-200 ${hover ? "opacity-100" : "opacity-0"}`}>
          <Link
            to={`/editor?project=${project.id}`}
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
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon name="dots" className="size-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-32 rounded-md border border-border bg-popover p-1 shadow-lg">
                <button
                  onClick={() => {
                    onEdit(project)
                    setShowMenu(false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground hover:bg-muted"
                >
                  <Icon name="edit" className="size-3" />
                  Rename
                </button>
                <button
                  onClick={() => {
                    onDelete(project.id)
                    setShowMenu(false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Icon name="trash" className="size-3" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <StatusBadge status={project.status} />
          <span className="text-[11px] text-muted-foreground">{project.size}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">Updated {timeAgo(project.updatedAt)}</p>
      </div>
    </div>
  )
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [newTitle, setNewTitle] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createTitle, setCreateTitle] = useState("")
  const [creating, setCreating] = useState(false)
  const { accessToken } = useAuth()

  const fetchProjects = async () => {
    if (!accessToken) return
    try {
      setLoading(true)
      const data = await api.getProjects(accessToken, {
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter
      })
      
      const projects: Project[] = data.map((p, i) => ({
        ...p,
        hue: 60 + (i * 70) % 300,
        thumb: [60 + (i * 70) % 300, 40 + (i * 50) % 280],
        duration: "0:00", // Will be calculated from clips
        size: "0 MB" // Will be calculated from media
      }))
      
      setProjects(projects)
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadProjects = async () => {
      if (!accessToken) return
      try {
        setLoading(true)
        const data = await api.getProjects(accessToken, {
          search: search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter
        })
        
        const projects: Project[] = data.map((p, i) => ({
          ...p,
          hue: 60 + (i * 70) % 300,
          thumb: [60 + (i * 70) % 300, 40 + (i * 50) % 280],
          duration: "0:00", // Will be calculated from clips
          size: "0 MB" // Will be calculated from media
        }))
        
        setProjects(projects)
      } catch (error) {
        console.error('Failed to fetch projects:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [accessToken, search, statusFilter])

  const handleCreateProject = () => {
    setCreateTitle("")
    setShowCreateDialog(true)
  }

  const handleConfirmCreate = async () => {
    if (!accessToken || !createTitle.trim()) return
    try {
      setCreating(true)
      await api.createProject(accessToken, { title: createTitle.trim() })
      await fetchProjects()
      setShowCreateDialog(false)
      setCreateTitle("")
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project)
    setNewTitle(project.title)
  }

  const handleSaveEdit = async () => {
    if (!accessToken || !editingProject || !newTitle.trim()) return
    
    try {
      await api.updateProject(accessToken, editingProject.id, { title: newTitle.trim() })
      await fetchProjects()
      setEditingProject(null)
      setNewTitle("")
    } catch (error) {
      console.error('Failed to update project:', error)
    }
  }

  const handleDeleteProject = async (id: string) => {
    if (!accessToken) return
    if (!confirm('Delete this project? This action cannot be undone.')) return
    
    try {
      await api.deleteProject(accessToken, id)
      await fetchProjects()
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const filtered = projects.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || p.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card/40 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Projects</h1>
              <p className="text-sm text-muted-foreground">Manage your video projects</p>
            </div>
            <button
              onClick={handleCreateProject}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Icon name="plus" className="size-4" />
              New project
            </button>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-64 rounded-md border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="processing">Processing</option>
              <option value="rendering">Rendering</option>
              <option value="exported">Exported</option>
            </select>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
              <Icon name="grid" className="mb-3 size-12 opacity-30" />
              <p className="text-sm">No projects found</p>
              <p className="text-xs">Create your first project to get started</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                />
              ))}
            </div>
          )}
        </div>

        {/* Create Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
              <h3 className="mb-4 text-lg font-semibold">Create New Project</h3>
              <input
                type="text"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && createTitle.trim()) handleConfirmCreate()
                  if (e.key === "Escape") setShowCreateDialog(false)
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Enter project name"
                autoFocus
                disabled={creating}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateDialog(false)}
                  disabled={creating}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCreate}
                  disabled={!createTitle.trim() || creating}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        {editingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
              <h3 className="mb-4 text-lg font-semibold">Rename Project</h3>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTitle.trim()) handleSaveEdit()
                  if (e.key === "Escape") {
                    setEditingProject(null)
                    setNewTitle("")
                  }
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Project name"
                autoFocus
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingProject(null)
                    setNewTitle("")
                  }}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!newTitle.trim()}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}