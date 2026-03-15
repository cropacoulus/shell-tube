import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import ProfileClient from "@/app/profile/profile-client";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getProfile, upsertProfile } from "@/lib/server/data-store";

export default async function ProfilePage() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");

  const existing = await getProfile(auth.userId);
  const profile =
    existing ??
    (await upsertProfile({
      userId: auth.userId,
      displayName: `${auth.userId.slice(0, 6)}...${auth.userId.slice(-4)}`,
      role: auth.role,
      updatedAt: new Date().toISOString(),
    }));

  return (
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <main className="px-6 py-8 md:px-10">
        <ProfileClient initialProfile={profile} />
      </main>
    </div>
  );
}
