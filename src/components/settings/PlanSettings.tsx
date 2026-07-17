
export function PlanSettings() {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-card">
        <div className="p-6">
          <h2 className="text-lg font-semibold">Plan & Billing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You are currently on the <strong>Free</strong> plan.
          </p>
        </div>
        <div className="border-t border-border p-6">
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">Upgrade to Pro</p>
                <p className="text-sm text-muted-foreground">
                  Unlock more features and get unlimited access to our platform.
                </p>
              </div>
              <button className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto">
                Upgrade
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="p-6">
          <h2 className="text-lg font-semibold">Usage</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your current usage for this billing cycle.
          </p>
        </div>
        <div className="border-t border-border p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Videos Created
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                5 / 10
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Storage Used
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                1.2 GB / 5 GB
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Exports
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                3 / 5
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="p-6">
          <h2 className="text-lg font-semibold">Invoice History</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View and download your past invoices.
          </p>
        </div>
        <div className="border-t border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Date
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                  {/* Action */}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-6 py-4 text-foreground">Jan 1, 2024</td>
                <td className="px-6 py-4 text-foreground">$10.00</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                    Paid
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <a
                    href="#"
                    className="font-medium text-primary hover:underline"
                  >
                    Download
                  </a>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-foreground">Dec 1, 2023</td>
                <td className="px-6 py-4 text-foreground">$10.00</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                    Paid
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <a
                    href="#"
                    className="font-medium text-primary hover:underline"
                  >
                    Download
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}