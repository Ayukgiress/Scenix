
export function SecuritySettings() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-6">
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Change your password.
        </p>
      </div>
      <form className="border-t border-border p-6">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-medium text-foreground"
            >
              Current password
            </label>
            <input
              type="password"
              id="current-password"
              className="mt-1 block w-full rounded-md border-border bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-foreground"
            >
              New password
            </label>
            <input
              type="password"
              id="new-password"
              className="mt-1 block w-full rounded-md border-border bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-foreground"
            >
              Confirm new password
            </label>
            <input
              type="password"
              id="confirm-password"
              className="mt-1 block w-full rounded-md border-border bg-background px-3 py-2 text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end border-t border-border pt-6">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Update password
          </button>
        </div>
      </form>
    </div>
  );
}