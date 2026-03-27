import type { UserProfile } from "@/lib/contracts/profile";
import { createDefaultProjectionStore } from "@/lib/projection-store";

const PROFILES_KEY = "stream:projection:profile:all";

export async function getProfileFromProjection(userId: string): Promise<UserProfile | null> {
  const projectionStore = createDefaultProjectionStore();
  const profiles =
    (await projectionStore.getJson<Record<string, UserProfile>>(PROFILES_KEY)) ?? {};

  return profiles[userId] ?? null;
}
