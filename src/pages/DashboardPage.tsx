import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useToast } from "@/hooks/useToast";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { useDashboardStore } from "@/store/dashboardStore";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { realtimeService } from "@/services/realtimeService";
import type { Project } from "@/types/dashboard";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  FileText, Home, Grid2x2, Sparkles, Download, Users, Settings,
  Pencil, Share2, Plus, MoreHorizontal, Play, Search, Bell, LogOut,
} from "lucide-react";



type IconName = "file" | "home" | "grid" | "ai" | "export" | "team" | "settings" | "edit" | "share" | "plus" | "dots" | "play" | "search" | "bell" | "logout";

function Icon({ name, className = "size-4" }: { name: IconName | string; className?: string }) {
  const cls = className;
  switch (name) {
    case "file":     return <FileText className={cls} />;
    case "home":     return <Home className={cls} />;
    case "grid":     return <Grid2x2 className={cls} />;
    case "ai":       return <Sparkles className={cls} />;
    case "export":   return <Download className={cls} />;
    case "team":     return <Users className={cls} />;
    case "settings": return <Settings className={cls} />;
    case "edit":     return <Pencil className={cls} />;
    case "share":    return <Share2 className={cls} />;
    case "plus":     return <Plus className={cls} />;
    case "dots":     return <MoreHorizontal className={cls} />;
    case "play":     return <Play className={cls} fill="currentColor" />;
    case "search":   return <Search className={cls} />;
    case "bell":     return <Bell className={cls} />;
    case "logout":   return <LogOut className={cls} />;
    default:         return null;
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    EXPORTED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    PUBLISHED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    IN_PROGRESS: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ARCHIVED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    DRAFT: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${map[status] ?? map.DRAFT}`}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

function ProjectCard({
  project,
  deleteProject,
}: {
  project: Project;
  deleteProject: (id: string) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(project.thumb[2] ?? null);

  // Generate a real thumbnail from the first video frame if a URL is available
  useEffect(() => {
    const url = project.thumb[2];
    if (!url || thumbUrl) return;
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.addEventListener("loadeddata", () => {
      video.currentTime = 0.5;
    }, { once: true });
    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 180;
      canvas.getContext("2d")?.drawImage(video, 0, 0, 320, 180);
      setThumbUrl(canvas.toDataURL("image/jpeg", 0.7));
      video.src = "";
    }, { once: true });
    video.load();
  }, [project.thumb, thumbUrl]);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteProject(project.id);
    setDropdownOpen(false);
  };

  return (
    <Link
      to={`/editor?project=${project.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-border/80 hover:shadow-[0_8px_32px_oklch(0_0_0/0.4)]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-video w-full overflow-hidden"
        style={{
          background: thumbUrl
            ? undefined
            : `linear-gradient(135deg, oklch(0.18 0.06 ${project.thumb[0]}), oklch(0.26 0.1 ${project.thumb[1]}))`,
        }}
      >
        {thumbUrl && (
          <img src={thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {!thumbUrl && (
          /* fake scanlines */
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, oklch(0 0 0 / 0.3) 3px, oklch(0 0 0 / 0.3) 4px)",
            }}
          />
        )}
        {/* duration badge */}
        <span className="absolute bottom-2 right-2 rounded bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-foreground backdrop-blur-sm">
          {project.duration}
        </span>
        {/* hover overlay */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm transition-opacity duration-200 ${hover ? "opacity-100" : "opacity-0"}`}
        >
          <span className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground shadow-lg">
            <Icon name="play" className="size-3" />
            Open editor
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[13px] font-medium text-foreground">
            {project.title}
          </p>
          <div className="relative">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDropdownOpen(!dropdownOpen);
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icon name="dots" className="size-4" />
            </button>
            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md bg-card shadow-lg ring-1 ring-border ring-opacity-5 focus:outline-none">
                <div
                  className="py-1"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="options-menu"
                >
                  <button
                    onClick={handleDelete}
                    className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-muted"
                    role="menuitem"
                  >
                    Delete Project
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <StatusBadge status={project.status} />
          <span className="text-[11px] text-muted-foreground">
            {project.size}
          </span>
        </div>
        {/* Progress bar for rendering/processing */}
        {(project.status === "ARCHIVED" || project.status === "IN_PROGRESS") &&
          project.progress !== undefined && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">
                  {project.status === "IN_PROGRESS"
                    ? "In progress"
                    : "Archiving"}
                  ...
                </span>
                <span className="font-mono text-foreground">
                  {project.progress}%
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          )}
        <p className="text-[11px] text-muted-foreground">
          Updated {project.updatedAt}
        </p>
      </div>
    </Link>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<
    "all" | "DRAFT" | "IN_PROGRESS" | "EXPORTED" | "PUBLISHED" | "ARCHIVED"
  >("all");
  const [search, setSearch] = useState("");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const { user, accessToken } = useAuth();

  const { error: toastError, success: toastSuccess } = useToast();

  const {
    projects,
    activities,
    stats,
    loading,
    error,
    setError,
    fetchProjects,
    fetchMedia,
    fetchExports,
    deleteProject,
  } = useDashboardStore();

  useEffect(() => {
    if (error) {
      toastError(error);
      setError(null);
    }
  }, [error, toastError, setError]);

  useEffect(() => {
    if (accessToken) {
      fetchProjects(accessToken);
      fetchMedia(accessToken);
      fetchExports(accessToken);
    }
  }, [accessToken, fetchProjects, fetchMedia, fetchExports]);

  useEffect(() => {
    const release = realtimeService.acquire();
    return () => release();
  }, []);

  const handleCreateProject = async () => {
    setCreateModalOpen(true);
  };

  const handleCreateProjectFromModal = async (title: string) => {
    if (!accessToken) return;
    const created = await useDashboardStore
      .getState()
      .createProjectAndReturn(accessToken, title);
    if (created?.id) {
      toastSuccess("Project created successfully!");
      useDashboardStore.getState().addActivity({
        icon: "grid",
        text: `Project "${title}" created`,
        time: "Just now",
      });
      navigate(`/editor?project=${created.id}`);
    }
    setCreateModalOpen(false);
  };

  const handleDeleteInitiated = (id: string) => {
    setProjectToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteProject = () => {
    if (!accessToken || !projectToDelete) return;
    const project = useDashboardStore.getState().projects.find((p) => p.id === projectToDelete);
    deleteProject(accessToken, projectToDelete);
    useDashboardStore.getState().addActivity({
      icon: "file",
      text: `Project "${project?.title ?? "Untitled"}" deleted`,
      time: "Just now",
    });
    toastSuccess("Project deleted successfully!");
    setDeleteModalOpen(false);
    setProjectToDelete(null);
  };

  const emailVerified =
    (user as { emailVerified?: boolean })?.emailVerified ?? true;

  const filtered = projects.filter((p) => {
    const matchFilter = filter === "all" || p.status === filter;
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <DashboardLayout>
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateProjectFromModal}
      />
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        message="Are you sure you want to delete this project? This action cannot be undone."
      />

      {/* Main content is wrapped by DashboardLayout */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Email verification banner */}
        {!emailVerified && user?.email && (
          <EmailVerificationBanner email={user.email} />
        )}

        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <div>
            <h1 className="text-[15px] font-semibold text-foreground">
              Dashboard
            </h1>
            <p className="text-[12px] text-muted-foreground">
              Welcome back, {user?.name?.split(" ")[0] ?? "there"} 👋
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Icon
                name="search"
                className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
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
            <button
              onClick={handleCreateProject}
              className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Icon name="plus" className="size-3.5" />
              New project
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="mx-auto w-full p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
                ))}
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[4/3] animate-pulse rounded-xl border border-border bg-card" />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mx-auto w-full space-y-8 p-6">
            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Total projects
                </p>
                <p className="mt-1.5 text-[26px] font-semibold tracking-tight text-foreground">
                  {stats.totalProjects}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {stats.totalProjects > 0 ? `${stats.totalProjects} total` : "No projects yet"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Storage used
                </p>
                <p className="mt-1.5 text-[26px] font-semibold tracking-tight text-foreground">
                  {stats.storageUsed} GB
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  of {stats.storageTotal} GB free
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Exports
                </p>
                <p className="mt-1.5 text-[26px] font-semibold tracking-tight text-foreground">
                  {stats.exports}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {stats.exports > 0 ? `${stats.exports} total` : "No exports yet"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  AI generations
                </p>
                <p className="mt-1.5 text-[26px] font-semibold tracking-tight text-foreground">
                  {stats.aiGenerations}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {stats.aiGenerations > 0 ? `${stats.aiGenerations} total` : "—"}
                </p>
              </div>
            </div>

            {/* Storage bar */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-foreground">
                  Storage
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {stats.storageUsed} GB{" "}
                  <span className="text-muted-foreground/50">
                    / {stats.storageTotal} GB
                  </span>
                </p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(stats.storageUsed / stats.storageTotal) * 100}%`,
                    background:
                      "linear-gradient(90deg, oklch(0.72 0.14 285), oklch(0.65 0.15 220))",
                  }}
                />
              </div>
              <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span>
                  <span className="mr-1 inline-block size-2 rounded-full bg-primary align-middle" />
                  Video — {stats.storageVideoGB.toFixed(2)} GB
                </span>
                <span>
                  <span className="mr-1 inline-block size-2 rounded-full bg-blue-400 align-middle" />
                  Audio — {stats.storageAudioGB.toFixed(2)} GB
                </span>
                <span>
                  <span className="mr-1 inline-block size-2 rounded-full bg-muted-foreground align-middle" />
                  Free — {Math.max(0, stats.storageTotal - stats.storageUsed).toFixed(2)} GB
                </span>
              </div>
            </div>

            {/* Projects + Activity side by side */}
            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
              {/* Projects */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[14px] font-semibold text-foreground">
                    Recent projects
                  </h2>
                  {/* Filter pills */}
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 text-[11px]">
                    {(
                      [
                        { v: "all", l: "All" },
                        { v: "DRAFT", l: "Draft" },
                        { v: "IN_PROGRESS", l: "In progress" },
                        { v: "EXPORTED", l: "Exported" },
                        { v: "PUBLISHED", l: "Published" },
                        { v: "ARCHIVED", l: "Archived" },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.v}
                        onClick={() => setFilter(f.v)}
                        className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                          filter === f.v
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f.l}
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
                    {filtered.map((p) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        deleteProject={handleDeleteInitiated}
                      />
                    ))}
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
                  <h2 className="text-[14px] font-semibold text-foreground">
                    Activity
                  </h2>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <div className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Live
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card">
                  {activities.length === 0 ? (
                  <div className="flex h-24 items-center justify-center text-[11px] text-muted-foreground">
                    No recent activity
                  </div>
                ) : activities.slice(0, 6).map((a, i) => (
                    <div
                      key={a.id}
                      className={`flex items-start gap-3 px-4 py-3 ${i < Math.min(activities.length, 6) - 1 ? "border-b border-border" : ""}`}
                    >
                      <div
                        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border ${
                          a.icon === "export"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : a.icon === "ai"
                              ? "border-primary/20 bg-primary/10 text-primary"
                              : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon name={a.icon} className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] leading-snug text-foreground">
                          {a.text}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {a.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                <h2 className="mb-3 mt-6 text-[14px] font-semibold text-foreground">
                  Quick actions
                </h2>
                <div className="flex flex-col gap-2">
                  {([
                    {
                      icon: "ai",
                      label: "Generate with AI",
                      sub: "Text to video",
                      to: "/editor",
                    },
                    {
                      icon: "edit",
                      label: "Open editor",
                      sub: "Start a new cut",
                      to: "/editor",
                    },
                    {
                      icon: "export",
                      label: "Export last project",
                      sub: projects[0]?.title ?? "No projects yet",
                      to: projects[0] ? `/editor?project=${projects[0].id}` : "/editor",
                    },
                  ] as const).map((q) => (
                    <Link
                      key={q.label}
                      to={q.to}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-border/80 hover:bg-muted/40"
                    >
                      <div className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-background text-muted-foreground">
                        <Icon name={q.icon} className="size-4" />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-foreground">
                          {q.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {q.sub}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}