import type { StoredUserRole } from "@/lib/auth/capabilities";
import { resolveEffectiveUserRole } from "@/lib/auth/effective-role";
import { getProfileRepository } from "@/lib/repositories";

export async function getEffectiveUserRole(input: {
  userId: string;
  fallbackRole: StoredUserRole;
}) {
  const profile = await getProfileRepository().getProfile(input.userId);
  return resolveEffectiveUserRole({
    fallbackRole: input.fallbackRole,
    storedRole: profile?.role,
  });
}
