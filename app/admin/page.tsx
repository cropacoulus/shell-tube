import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import AdminClient from "@/app/admin/admin-client";
import CreatorApplicationsPanel from "@/app/admin/creator-applications-panel";
import { canModeratePlatform } from "@/lib/auth/capabilities";
import { getAuthContextFromHeaders } from "@/lib/server/auth";

export default async function AdminPage() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");
  if (!canModeratePlatform(auth.role)) {
    return (
      <div className="app-shell">
        <StickyNavbar />
        <main className="mx-auto max-w-3xl px-6 py-16 md:px-10">
          <section className="app-panel rounded-[2rem] p-8">
            <p className="app-kicker">Restricted surface</p>
            <h1 className="mt-3 text-3xl font-semibold">Admin access required</h1>
            <p className="mt-3 text-white/70">
            Your wallet is currently registered as user role. Add your wallet to `ADMIN_WALLETS`
            environment variable to unlock admin dashboard.
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell px-6 py-8 text-white md:px-10 md:py-12">
      <StickyNavbar />
      <main className="mx-auto max-w-7xl space-y-6 pt-6">
        <section className="app-panel rounded-[2rem] p-6 md:p-8">
          <p className="app-kicker">Platform operations</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-5xl">Moderation, catalog control, and creator approvals.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/68 md:text-base">
            The admin surface stays intentionally separate from the creator-facing product, but it should still share the same visual language and clarity.
          </p>
        </section>
        <AdminClient />
        <CreatorApplicationsPanel />
      </main>
    </div>
  );
}
