import type { StoredUserRole } from "@/lib/auth/capabilities";
import { getUserRoleKind } from "@/lib/blockchain/role-registry";

export async function getEffectiveUserRole(input: {
  userId: string;
  fallbackRole: StoredUserRole;
}) {
  void input.fallbackRole;
  return getUserRoleKind(input.userId);
}
