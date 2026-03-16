import type { EntitlementRequest } from "@/lib/contracts/entitlement";

export type PlaybackContext = {
  lessonId: string;
  courseId: string;
  manifestBlobKey: string;
};

export const buildPlaybackContext = (lesson: {
  id: string;
  courseId: string;
  manifestBlobKey: string;
}): PlaybackContext => {
  return {
    lessonId: lesson.id,
    courseId: lesson.courseId,
    manifestBlobKey: lesson.manifestBlobKey,
  };
};

export const toEntitlementRequest = (
  context: PlaybackContext,
  auth: {
    userId: string;
    profileId: string;
    region: string;
  },
): EntitlementRequest => {
  return {
    userId: auth.userId,
    profileId: auth.profileId,
    titleId: context.courseId,
    lessonId: context.lessonId,
    region: auth.region,
  };
};
