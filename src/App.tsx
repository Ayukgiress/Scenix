import { BrowserRouter, Routes, Route } from "react-router-dom"
import { PublicLayout } from "@/layouts/PublicLayout"
import { LandingPage } from "@/pages/LandingPage"
import { EditorPage } from "@/pages/EditorPage"
import { ExportPage } from "@/pages/ExportPage"
import { LoginPage } from "@/pages/LoginPage"
import { SignupPage } from "@/pages/SignupPage"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
        </Route>
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
