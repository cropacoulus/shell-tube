import type { UserProfile, UserRole } from "@/lib/contracts/profile";

export type ProfileRepository = {
  getProfile(userId: string): Promise<UserProfile | null>;
  listProfilesByRole(role: UserRole): Promise<UserProfile[]>;
  upsertProfile(profile: UserProfile): Promise<UserProfile>;
};
