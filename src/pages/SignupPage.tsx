import { useState, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { HeroBg } from "@/components/landing/HeroBg"
import { useAuth } from "@/hooks/useAuth"
import { api } from "@/lib/api"

function strengthLabel(score: number) {
  if (score === 0) return { label: "", color: "" }
  if (score === 1) return { label: "Weak",   color: "bg-red-500" }
  if (score === 2) return { label: "Fair",   color: "bg-yellow-400" }
  if (score === 3) return { label: "Good",   color: "bg-blue-400" }
  return             { label: "Strong", color: "bg-emerald-500" }
}

function usePasswordStrength(pw: string) {
  return useMemo(() => {
    if (!pw) return 0
    let s = 0
    if (pw.length >= 8)          s++
    if (/[A-Z]/.test(pw))        s++
    if (/[0-9]/.test(pw))        s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    return s
  }, [pw])
}

export function SignupPage() {
  const [show, setShow] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const strength = usePasswordStrength(password)
  const { label, color } = strengthLabel(strength)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const name = `${firstName} ${lastName}`.trim()
      await register(name, email, password)
      navigate("/auth/verify-pending", { state: { email } })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = () => {
    window.location.href = api.googleAuthUrl
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left panel ── */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden p-10 lg:flex">
        <HeroBg />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{ background: "linear-gradient(to bottom, transparent, oklch(0.16 0.005 260))" }}
        />

        <Link to="/" className="relative z-10 flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <span className="grid size-7 place-items-center rounded-md bg-foreground text-background">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m10 9 5 3-5 3z" fill="currentColor" />
            </svg>
          </span>
          Scenix
        </Link>

        {/* feature bullets */}
        <div className="relative z-10 flex flex-col gap-4">
          {[
            ["AI generation", "Turn a text prompt into cinematic footage instantly."],
            ["4K cloud export", "Render in the cloud — no GPU required on your machine."],
            ["Multi-track timeline", "Layer video, audio, and effects like a pro NLE."],
          ].map(([title, desc]) => (
            <div key={title} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <svg viewBox="0 0 24 24" className="size-3 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <div>
                <p className="text-[13px] font-medium text-foreground">{title}</p>
                <p className="text-[12px] text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-[480px] lg:shrink-0 lg:border-l lg:border-border">
        {/* Mobile logo */}
        <Link to="/" className="mb-8 flex items-center gap-2 text-[13px] font-semibold text-foreground lg:hidden">
          <span className="grid size-7 place-items-center rounded-md bg-foreground text-background">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m10 9 5 3-5 3z" fill="currentColor" />
            </svg>
          </span>
          Scenix
        </Link>

        <div className="w-full max-w-sm">
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Create your account</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Free forever. No credit card required.</p>

          {/* OAuth */}
          <div className="mt-7 flex flex-col gap-2">
            <button type="button" onClick={handleGoogleSignup} className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-border bg-card text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
              <svg viewBox="0 0 24 24" className="size-4" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            <button className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-border bg-card text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
              <svg viewBox="0 0 24 24" className="size-4 fill-foreground">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Continue with GitHub
            </button>
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {error && (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-500">
              {error}
            </div>
          )}

          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-foreground">First name</label>
                <input
                  type="text"
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="h-10 rounded-md border border-border bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-foreground">Last name</label>
                <input
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="h-10 rounded-md border border-border bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-10 w-full rounded-md border border-border bg-card px-3 pr-10 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {show ? (
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Strength meter */}
              {password.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          strength >= n ? color : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-10 w-full rounded-md bg-primary text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>

            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              By creating an account you agree to our{" "}
              <a href="#" className="text-foreground hover:text-primary">Terms of Service</a>
              {" "}and{" "}
              <a href="#" className="text-foreground hover:text-primary">Privacy Policy</a>.
            </p>
          </form>

          <p className="mt-5 text-center text-[12px] text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-foreground transition-colors hover:text-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
