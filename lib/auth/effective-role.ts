import type { StoredUserRole } from "./capabilities.ts";
import { normalizeUserRole } from "./capabilities.ts";

export function resolveEffectiveUserRole(input: {
  fallbackRole: StoredUserRole;
  storedRole?: StoredUserRole | null;
}) {
  const fallbackRole = normalizeUserRole(input.fallbackRole);
  if (fallbackRole === "admin") return "admin" as const;

  const storedRole = normalizeUserRole(input.storedRole);
  if (storedRole === "admin") return "admin" as const;
  if (storedRole === "creator") return "creator" as const;
  return fallbackRole;
}
