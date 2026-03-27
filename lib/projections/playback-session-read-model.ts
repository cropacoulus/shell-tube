import { createDefaultProjectionStore } from "@/lib/projection-store";
import type { PlaybackSessionRecord } from "@/lib/contracts/activity";

export type PlaybackSessionProjectionSnapshot = {
  playbackSessionId: string;
  userId: string;
  profileId: string;
  lessonId: string;
  courseId: string;
  manifestBlobKey: string;
  entitlementSource: string;
  expiresAt: string;
  createdAt: string;
};

export async function getPlaybackSessionFromProjection(
  playbackSessionId: string,
): Promise<PlaybackSessionRecord | null> {
  const projectionStore = createDefaultProjectionStore();
  const sessions =
    (await projectionStore.getJson<Record<string, PlaybackSessionProjectionSnapshot>>(
      "stream:projection:activity:playback",
    )) ?? {};

  const session = sessions[playbackSessionId];
  if (!session) return null;

  return {
    id: session.playbackSessionId,
    userId: session.userId,
    profileId: session.profileId,
    courseId: session.courseId,
    lessonId: session.lessonId,
    manifestBlobKey: session.manifestBlobKey,
    entitlementSource: session.entitlementSource,
    playbackToken: "",
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
  };
}
