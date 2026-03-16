import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import ProfileClient from "@/app/profile/profile-client";
import { getProfileRepository } from "@/lib/repositories";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getEffectiveUserRole } from "@/lib/server/effective-role";

export default async function ProfilePage() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");
  const profileRepository = getProfileRepository();
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });

  const existing = await profileRepository.getProfile(auth.userId);
  const profile =
    existing ??
    (await profileRepository.upsertProfile({
      userId: auth.userId,
      displayName: `${auth.userId.slice(0, 6)}...${auth.userId.slice(-4)}`,
      role: effectiveRole,
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
