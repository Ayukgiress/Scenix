import { useEffect, useState } from "react"
import { useSearchParams, Link, useNavigate } from "react-router-dom"
import { api } from "@/lib/api"

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get("token")
      if (!token) {
        setStatus("error")
        setMessage("No verification token provided")
        return
      }

      try {
        const res = await api.verifyEmail(token)
        setStatus("success")
        setMessage(res.message || "Email verified successfully!")
      } catch (err) {
        setStatus("error")
        const errorMsg = err instanceof Error ? err.message : "Verification failed. The token may be invalid or expired."
        setMessage(errorMsg)
        console.error("Verification error:", err)
      }
    }

    verifyToken()
  }, [searchParams, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="mx-auto mb-8 inline-flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <span className="grid size-7 place-items-center rounded-md bg-foreground text-background">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m10 9 5 3-5 3z" fill="currentColor" />
            </svg>
          </span>
          Scenix
        </Link>

        <div className="rounded-lg border border-border bg-card p-8">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-2 border-border border-t-primary" />
              <h1 className="text-[18px] font-semibold text-foreground">Verifying email...</h1>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
                <svg viewBox="0 0 24 24" className="size-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-[18px] font-semibold text-foreground">Email verified!</h1>
              <p className="mt-2 text-[13px] text-muted-foreground">{message}</p>
              <Link to="/login" className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-6 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
                Sign in
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-500/10">
                <svg viewBox="0 0 24 24" className="size-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h1 className="text-[18px] font-semibold text-foreground">Verification failed</h1>
              <p className="mt-2 text-[13px] text-muted-foreground">{message}</p>
              <div className="mt-6 flex gap-2">
                <Link to="/login" className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
                  Sign in
                </Link>
                <Link to="/signup" className="inline-flex h-10 items-center rounded-md border border-border px-6 text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
                  Sign up
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
