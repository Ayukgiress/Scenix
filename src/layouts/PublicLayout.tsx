import { Outlet } from "react-router-dom"
import { Topbar } from "@/components/layout/Topbar"
import { Footer } from "@/components/layout/Footer"

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Topbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
