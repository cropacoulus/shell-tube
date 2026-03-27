import { ClientAuthGate } from "@/app/_components/client-auth";
import StickyNavbar from "@/app/_components/sticky-navbar";
import ProfileClient from "@/app/profile/profile-client";

export default function ProfilePage() {
  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-12">
        <ClientAuthGate><ProfileClient /></ClientAuthGate>
      </main>
    </div>
  );
}
