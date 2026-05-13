import { LogoutButton } from "@/components/auth/logout-button";
import { InventoryDashboard } from "@/components/inventory/dashboard";
import { requireUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await requireUser();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6 text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Operations</p>
            <p className="text-xl font-semibold">Regional Inventory Pricing</p>
          </div>
          <LogoutButton />
        </header>
        <InventoryDashboard canEdit={user.role === "ADMIN"} username={user.username} />
      </div>
    </main>
  );
}
