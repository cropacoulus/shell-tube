import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import ProfileClient from "@/app/profile/profile-client";
import { getProfileFromProjection } from "@/lib/projections/profile-read-model";
import { getProfileRepository } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getEffectiveUserRole } from "@/lib/server/effective-role";

export default async function ProfilePage() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");
  const profileRepository = getProfileRepository();
  const optionB = createOptionBConfig();
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });

  const existing = optionB.projectionStoreBackend === "upstash"
    ? await getProfileFromProjection(auth.userId)
    : await profileRepository.getProfile(auth.userId);
  const profile =
    existing ??
    (await profileRepository.upsertProfile({
      userId: auth.userId,
      displayName: `${auth.userId.slice(0, 6)}...${auth.userId.slice(-4)}`,
      role: effectiveRole,
      updatedAt: new Date().toISOString(),
    }));

  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-12">
        <ProfileClient initialProfile={profile} />
      </main>
    </div>
  );
}
