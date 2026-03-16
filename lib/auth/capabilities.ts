import type { UserRole } from "@/lib/contracts/profile";

export type StoredUserRole = UserRole | "user";

export const normalizeUserRole = (role: string | null | undefined): UserRole => {
  if (role === "admin") return "admin";
  if (role === "creator") return "creator";
  return "student";
};

export const canPublishContent = (role: StoredUserRole): boolean => {
  const normalizedRole = normalizeUserRole(role);
  return normalizedRole === "creator" || normalizedRole === "admin";
};

export const canViewCreatorAnalytics = (role: StoredUserRole): boolean => {
  const normalizedRole = normalizeUserRole(role);
  return normalizedRole === "creator" || normalizedRole === "admin";
};

export const canModeratePlatform = (role: StoredUserRole): boolean => {
  return normalizeUserRole(role) === "admin";
};
