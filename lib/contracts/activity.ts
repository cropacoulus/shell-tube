export type LessonProgressRecord = {
  id: string;
  userId: string;
  profileId: string;
  lessonId: string;
  courseId: string;
  progressPercent: number;
  lastPositionSec: number;
  completedAt?: string;
  updatedAt: string;
};

export type CourseEnrollmentRecord = {
  id: string;
  userId: string;
  profileId: string;
  courseId: string;
  source: "manual" | "entitlement";
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlaybackSessionRecord = {
  id: string;
  userId: string;
  profileId: string;
  courseId: string;
  lessonId: string;
  manifestBlobKey: string;
  entitlementSource: string;
  playbackToken: string;
  expiresAt: string;
  createdAt: string;
};

export type QoeEventRecord = {
  id: string;
  playbackSessionId: string;
  userId: string;
  profileId: string;
  courseId: string;
  lessonId: string;
  type: "startup" | "rebuffer_start" | "rebuffer_end" | "bitrate_change" | "fatal_error" | "playback_end";
  eventTs: string;
  positionMs: number;
  bitrateKbps?: number;
  rebufferMs?: number;
  peerHitRatio?: number;
  errorCode?: string;
  deviceId: string;
  createdAt: string;
};
