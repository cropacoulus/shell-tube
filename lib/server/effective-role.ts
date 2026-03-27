import type { StoredUserRole } from "@/lib/auth/capabilities";
import { resolveEffectiveUserRole } from "@/lib/auth/effective-role";
import { isProjectedCreator } from "@/lib/projections/creator-application-read-model";
import { getProfileRepository } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";

export async function getEffectiveUserRole(input: {
  userId: string;
  fallbackRole: StoredUserRole;
}) {
  if (createOptionBConfig().projectionStoreBackend === "upstash") {
    const projectedCreator = await isProjectedCreator(input.userId);
    return resolveEffectiveUserRole({
      fallbackRole: input.fallbackRole,
      storedRole: projectedCreator ? "creator" : undefined,
    });
  }

  const profile = await getProfileRepository().getProfile(input.userId);
  return resolveEffectiveUserRole({
    fallbackRole: input.fallbackRole,
    storedRole: profile?.role,
  });
}
