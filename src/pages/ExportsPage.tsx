import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { api, Export } from "@/lib/api"
import { DashboardLayout } from "@/layouts/DashboardLayout"

function Icon({ name, className = "size-4" }: { name: string; className?: string }) {
  const props = { viewBox: "0 0 24 24", className, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (name) {
    case "download": return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-15"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    case "play": return <svg {...props}><polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/></svg>
    case "stop": return <svg {...props}><rect x="6" y="6" width="12" height="12"/></svg>
    case "clock": return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    case "check": return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>
    case "x": return <svg {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    case "search": return <svg {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    default: return null
  }
}

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { bg: string; text: string; icon: string }> = {
    completed: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: "check" },
    processing: { bg: "bg-blue-500/10", text: "text-blue-400", icon: "clock" },
    failed: { bg: "bg-red-500/10", text: "text-red-400", icon: "x" },
    cancelled: { bg: "bg-gray-500/10", text: "text-gray-400", icon: "stop" },
  }
  
  const config = statusMap[status] || statusMap.processing
  
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium capitalize ${config.bg} ${config.text} border-current/20`}>
      <Icon name={config.icon} className="size-3" />
      {status}
    </span>
  )
}

function ExportCard({ exportItem, onCancel }: { exportItem: Export; onCancel: (id: string) => void }) {
  const canCancel = exportItem.status === 'processing'
  
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium text-foreground text-sm">Export #{exportItem.id.slice(-6)}</h3>
            <StatusBadge status={exportItem.status} />
          </div>
          
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Format: {exportItem.format.toUpperCase()}</p>
            <p>Quality: {exportItem.quality}</p>
            <p>Created: {new Date(exportItem.createdAt).toLocaleString()}</p>
          </div>
          
          {exportItem.progress !== undefined && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono text-foreground">{exportItem.progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${exportItem.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {exportItem.outputUrl && exportItem.status === 'completed' && (
            <a
              href={exportItem.outputUrl}
              download
              className="flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Icon name="download" className="size-3" />
              Download
            </a>
          )}
          
          {canCancel && (
            <button
              onClick={() => onCancel(exportItem.id)}
              className="flex items-center gap-1 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Icon name="stop" className="size-3" />
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function ExportsPage() {
  const [exports, setExports] = useState<Export[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { accessToken } = useAuth()

  const fetchExports = async () => {
    if (!accessToken) return
    try {
      setLoading(true)
      const data = await api.getExports(accessToken, {
        status: statusFilter === "all" ? undefined : statusFilter
      })
      setExports(data)
    } catch (error) {
      console.error('Failed to fetch exports:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExports()
  }, [accessToken, statusFilter])

  const handleCancel = async (id: string) => {
    if (!accessToken) return
    if (!confirm('Cancel this export?')) return
    
    try {
      await api.cancelExport(accessToken, id)
      await fetchExports()
    } catch (error) {
      console.error('Failed to cancel export:', error)
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/40 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Exports</h1>
            <p className="text-sm text-muted-foreground">Track your video exports and downloads</p>
          </div>
        </div>

        <div className="mt-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All exports</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : exports.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
            <Icon name="download" className="mb-3 size-12 opacity-30" />
            <p className="text-sm">No exports found</p>
            <p className="text-xs">Start exporting projects to see them here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {exports.map(exp => (
              <ExportCard key={exp.id} exportItem={exp} onCancel={handleCancel} />
            ))}
          </div>
        )}
      </div>
      </div>
    </DashboardLayout>
  )
}