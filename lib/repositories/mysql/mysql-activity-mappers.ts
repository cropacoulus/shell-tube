import type {
  CourseEnrollmentRecord,
  LessonProgressRecord,
  PlaybackSessionRecord,
  QoeEventRecord,
} from "../../contracts/activity.ts";

type SqlDateValue = string | Date;

type LessonProgressRow = {
  id: string;
  user_id: string;
  profile_id: string;
  lesson_id: string;
  course_id: string;
  progress_percent: number;
  last_position_sec: number;
  completed_at: SqlDateValue | null;
  updated_at: SqlDateValue;
};

type CourseEnrollmentRow = {
  id: string;
  user_id: string;
  profile_id: string;
  course_id: string;
  source: "manual" | "entitlement";
  active: number | boolean;
  created_at: SqlDateValue;
  updated_at: SqlDateValue;
};

type PlaybackSessionRow = {
  id: string;
  user_id: string;
  profile_id: string;
  course_id: string;
  lesson_id: string;
  manifest_blob_key: string;
  entitlement_source: string;
  playback_token: string;
  expires_at: SqlDateValue;
  created_at: SqlDateValue;
};

type QoeEventRow = {
  id: string;
  playback_session_id: string;
  user_id: string;
  profile_id: string;
  course_id: string;
  lesson_id: string;
  event_type: QoeEventRecord["type"];
  event_ts: SqlDateValue;
  position_ms: number;
  bitrate_kbps: number | null;
  rebuffer_ms: number | null;
  peer_hit_ratio: number | null;
  error_code: string | null;
  device_id: string;
  created_at: SqlDateValue;
};

function toIsoString(value: SqlDateValue): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapLessonProgressRow(row: LessonProgressRow): LessonProgressRecord {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    lessonId: row.lesson_id,
    courseId: row.course_id,
    progressPercent: row.progress_percent,
    lastPositionSec: row.last_position_sec,
    completedAt: row.completed_at ? toIsoString(row.completed_at) : undefined,
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapCourseEnrollmentRow(row: CourseEnrollmentRow): CourseEnrollmentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    courseId: row.course_id,
    source: row.source,
    active: Boolean(row.active),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapPlaybackSessionRow(row: PlaybackSessionRow): PlaybackSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    courseId: row.course_id,
    lessonId: row.lesson_id,
    manifestBlobKey: row.manifest_blob_key,
    entitlementSource: row.entitlement_source,
    playbackToken: row.playback_token,
    expiresAt: toIsoString(row.expires_at),
    createdAt: toIsoString(row.created_at),
  };
}

export function mapQoeEventRow(row: QoeEventRow): QoeEventRecord {
  return {
    id: row.id,
    playbackSessionId: row.playback_session_id,
    userId: row.user_id,
    profileId: row.profile_id,
    courseId: row.course_id,
    lessonId: row.lesson_id,
    type: row.event_type,
    eventTs: toIsoString(row.event_ts),
    positionMs: row.position_ms,
    bitrateKbps: row.bitrate_kbps ?? undefined,
    rebufferMs: row.rebuffer_ms ?? undefined,
    peerHitRatio: row.peer_hit_ratio ?? undefined,
    errorCode: row.error_code ?? undefined,
    deviceId: row.device_id,
    createdAt: toIsoString(row.created_at),
  };
}
