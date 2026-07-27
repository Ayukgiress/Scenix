import { useLocation, Link } from "react-router-dom"

export function VerifyPendingPage() {
  const location = useLocation()
  const email = location.state?.email || "your email"

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
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <svg viewBox="0 0 24 24" className="size-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h1 className="text-[18px] font-semibold text-foreground">Check your email</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            We've sent a verification link to <span className="font-medium text-foreground">{email}</span>
          </p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            Click the link in the email to verify your account and get started.
          </p>
          <div className="mt-6 rounded-md bg-muted p-3 text-[12px] text-muted-foreground">
            Didn't receive the email? Check your spam folder or contact support.
          </div>
        </div>
      </div>
    </div>
  )
}
