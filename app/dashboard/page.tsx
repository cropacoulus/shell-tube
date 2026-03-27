import { ClientAuthGate } from "@/app/_components/client-auth";
import StickyNavbar from "@/app/_components/sticky-navbar";
import DashboardClient from "@/app/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8 md:px-10 md:py-12">
        <ClientAuthGate>{() => <DashboardClient />}</ClientAuthGate>
      </main>
    </div>
  );
}
