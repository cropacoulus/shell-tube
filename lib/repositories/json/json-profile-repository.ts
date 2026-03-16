import type { ProfileRepository } from "@/lib/repositories/profile-repository";
import { getProfile, listProfilesByRole, upsertProfile } from "@/lib/server/data-store";

export const jsonProfileRepository: ProfileRepository = {
  getProfile,
  listProfilesByRole,
  upsertProfile,
};
