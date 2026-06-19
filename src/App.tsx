import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "@/context/AuthContext"
import { PublicLayout } from "@/layouts/PublicLayout"
import { LandingPage } from "@/pages/LandingPage"
import { EditorPage } from "@/pages/EditorPage"
import { ExportPage } from "@/pages/ExportPage"
import { ExportsPage } from "@/pages/ExportsPage"
import { MediaPage } from "@/pages/MediaPage"
import { ProjectsPage } from "@/pages/ProjectsPage"
import { LoginPage } from "@/pages/LoginPage"
import { SignupPage } from "@/pages/SignupPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { VerifyEmailPage } from "@/pages/VerifyEmailPage"
import { VerifyPendingPage } from "@/pages/VerifyPendingPage"

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/exports" element={<ExportsPage />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/verify-pending" element={<VerifyPendingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
