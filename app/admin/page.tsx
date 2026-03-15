import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import AdminClient from "@/app/admin/admin-client";
import { getAuthContextFromHeaders } from "@/lib/server/auth";

export default async function AdminPage() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");
  if (auth.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#06080f] text-white">
        <StickyNavbar />
        <main className="mx-auto max-w-3xl px-6 py-16 md:px-10">
          <h1 className="text-3xl font-semibold">Admin Access Required</h1>
          <p className="mt-2 text-white/70">
            Your wallet is currently registered as user role. Add your wallet to `ADMIN_WALLETS`
            environment variable to unlock admin dashboard.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080f] px-6 py-8 text-white md:px-10">
      <StickyNavbar />
      <main className="pt-6">
        <AdminClient />
      </main>
    </div>
  );
}
