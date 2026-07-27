import { useState } from "react"
import { api } from "@/lib/api"

interface EmailVerificationBannerProps {
  email: string
}

export function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (dismissed) return null

  const handleResend = async () => {
    setSending(true)
    try {
      await api.forgotPassword(email) // Reusing this to trigger email resend
      setSent(true)
      setTimeout(() => setSent(false), 5000)
    } catch (err) {
      console.error("Failed to resend verification email:", err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-b border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-[13px] font-medium text-foreground">Please verify your email</p>
            <p className="text-[12px] text-muted-foreground">Check your inbox for the verification link.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sent ? (
            <span className="text-[12px] text-emerald-500">Email sent!</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={sending}
              className="text-[12px] font-medium text-foreground transition-colors hover:text-primary disabled:opacity-50"
            >
              {sending ? "Sending..." : "Resend email"}
            </button>
          )}
          <button onClick={() => setDismissed(true)} className="text-muted-foreground transition-colors hover:text-foreground">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
