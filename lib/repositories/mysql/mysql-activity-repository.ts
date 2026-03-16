import type { PlaybackSessionRecord, QoeEventRecord } from "@/lib/contracts/activity";
import type { ActivityRepository } from "@/lib/repositories/activity-repository";
import { getMySqlPool } from "@/lib/repositories/mysql/mysql-connection";
import { toMysqlDateTime } from "@/lib/repositories/mysql/mysql-datetime";
import {
  mapCourseEnrollmentRow,
  mapLessonProgressRow,
  mapPlaybackSessionRow,
  mapQoeEventRow,
} from "@/lib/repositories/mysql/mysql-activity-mappers";

type LessonProgressRow = {
  id: string;
  user_id: string;
  profile_id: string;
  lesson_id: string;
  course_id: string;
  progress_percent: number;
  last_position_sec: number;
  completed_at: string | Date | null;
  updated_at: string | Date;
};

type CourseEnrollmentRow = {
  id: string;
  user_id: string;
  profile_id: string;
  course_id: string;
  source: "manual" | "entitlement";
  active: number | boolean;
  created_at: string | Date;
  updated_at: string | Date;
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
  expires_at: string | Date;
  created_at: string | Date;
};

type QoeEventRow = {
  id: string;
  playback_session_id: string;
  user_id: string;
  profile_id: string;
  course_id: string;
  lesson_id: string;
  event_type: QoeEventRecord["type"];
  event_ts: string | Date;
  position_ms: number;
  bitrate_kbps: number | null;
  rebuffer_ms: number | null;
  peer_hit_ratio: number | null;
  error_code: string | null;
  device_id: string;
  created_at: string | Date;
};

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

async function getProgressByCompositeKey(userId: string, lessonId: string) {
  const pool = await getMySqlPool();
  const [rows] = await pool.execute(
    "SELECT id, user_id, profile_id, lesson_id, course_id, progress_percent, last_position_sec, completed_at, updated_at FROM lesson_progress WHERE user_id = ? AND lesson_id = ? LIMIT 1",
    [userId, lessonId],
  );
  const row = (rows as LessonProgressRow[])[0];
  return row ? mapLessonProgressRow(row) : null;
}

async function getEnrollmentByCompositeKey(userId: string, courseId: string) {
  const pool = await getMySqlPool();
  const [rows] = await pool.execute(
    "SELECT id, user_id, profile_id, course_id, source, active, created_at, updated_at FROM course_enrollments WHERE user_id = ? AND course_id = ? LIMIT 1",
    [userId, courseId],
  );
  const row = (rows as CourseEnrollmentRow[])[0];
  return row ? mapCourseEnrollmentRow(row) : null;
}

export const mysqlActivityRepository: ActivityRepository = {
  async listAllLessonProgress() {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT id, user_id, profile_id, lesson_id, course_id, progress_percent, last_position_sec, completed_at, updated_at FROM lesson_progress ORDER BY updated_at DESC",
    );
    return (rows as LessonProgressRow[]).map(mapLessonProgressRow);
  },
  async listLessonProgressByUser(userId) {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT id, user_id, profile_id, lesson_id, course_id, progress_percent, last_position_sec, completed_at, updated_at FROM lesson_progress WHERE user_id = ? ORDER BY updated_at DESC",
      [userId],
    );
    return (rows as LessonProgressRow[]).map(mapLessonProgressRow);
  },
  async upsertLessonProgress(input) {
    const pool = await getMySqlPool();
    const now = toMysqlDateTime(new Date());
    const existing = await getProgressByCompositeKey(input.userId, input.lessonId);
    if (existing) {
      await pool.execute(
        `UPDATE lesson_progress
         SET profile_id = ?, course_id = ?, progress_percent = ?, last_position_sec = ?, completed_at = ?, updated_at = ?
         WHERE id = ?`,
        [
          input.profileId,
          input.courseId,
          input.progressPercent,
          input.lastPositionSec,
          input.completedAt ? toMysqlDateTime(input.completedAt) : null,
          now,
          existing.id,
        ],
      );
      const updated = await getProgressByCompositeKey(input.userId, input.lessonId);
      if (!updated) throw new Error("Unable to load updated lesson progress record.");
      return updated;
    }

    const id = generateId("prog");
    await pool.execute(
      `INSERT INTO lesson_progress
       (id, user_id, profile_id, lesson_id, course_id, progress_percent, last_position_sec, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.userId,
        input.profileId,
        input.lessonId,
        input.courseId,
        input.progressPercent,
        input.lastPositionSec,
        input.completedAt ? toMysqlDateTime(input.completedAt) : null,
        now,
      ],
    );
    const created = await getProgressByCompositeKey(input.userId, input.lessonId);
    if (!created) throw new Error("Unable to load created lesson progress record.");
    return created;
  },
  async listCourseEnrollmentsByUser(userId) {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT id, user_id, profile_id, course_id, source, active, created_at, updated_at FROM course_enrollments WHERE user_id = ? ORDER BY updated_at DESC",
      [userId],
    );
    return (rows as CourseEnrollmentRow[]).map(mapCourseEnrollmentRow);
  },
  async upsertCourseEnrollment(input) {
    const pool = await getMySqlPool();
    const now = toMysqlDateTime(new Date());
    const existing = await getEnrollmentByCompositeKey(input.userId, input.courseId);
    if (existing) {
      await pool.execute(
        `UPDATE course_enrollments
         SET profile_id = ?, source = ?, active = ?, updated_at = ?
         WHERE id = ?`,
        [input.profileId, input.source, input.active ? 1 : 0, now, existing.id],
      );
      const updated = await getEnrollmentByCompositeKey(input.userId, input.courseId);
      if (!updated) throw new Error("Unable to load updated course enrollment record.");
      return updated;
    }

    const id = generateId("enr");
    await pool.execute(
      `INSERT INTO course_enrollments
       (id, user_id, profile_id, course_id, source, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.userId, input.profileId, input.courseId, input.source, input.active ? 1 : 0, now, now],
    );
    const created = await getEnrollmentByCompositeKey(input.userId, input.courseId);
    if (!created) throw new Error("Unable to load created course enrollment record.");
    return created;
  },
  async createPlaybackSessionRecord(input) {
    const pool = await getMySqlPool();
    const record: PlaybackSessionRecord = {
      createdAt: new Date().toISOString(),
      ...input,
    };
    await pool.execute(
      `INSERT INTO playback_sessions
       (id, user_id, profile_id, course_id, lesson_id, manifest_blob_key, entitlement_source, playback_token, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.userId,
        record.profileId,
        record.courseId,
        record.lessonId,
        record.manifestBlobKey,
        record.entitlementSource,
        record.playbackToken,
        toMysqlDateTime(record.expiresAt),
        toMysqlDateTime(record.createdAt),
      ],
    );
    return record;
  },
  async listAllPlaybackSessionRecords() {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT id, user_id, profile_id, course_id, lesson_id, manifest_blob_key, entitlement_source, playback_token, expires_at, created_at FROM playback_sessions ORDER BY created_at DESC",
    );
    return (rows as PlaybackSessionRow[]).map(mapPlaybackSessionRow);
  },
  async getPlaybackSessionRecordById(id) {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT id, user_id, profile_id, course_id, lesson_id, manifest_blob_key, entitlement_source, playback_token, expires_at, created_at FROM playback_sessions WHERE id = ? LIMIT 1",
      [id],
    );
    const row = (rows as PlaybackSessionRow[])[0];
    return row ? mapPlaybackSessionRow(row) : null;
  },
  async listAllQoeEventRecords() {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT id, playback_session_id, user_id, profile_id, course_id, lesson_id, event_type, event_ts, position_ms, bitrate_kbps, rebuffer_ms, peer_hit_ratio, error_code, device_id, created_at FROM qoe_events ORDER BY event_ts DESC",
    );
    return (rows as QoeEventRow[]).map(mapQoeEventRow);
  },
  async createQoeEventRecords(input) {
    if (input.length === 0) return [];
    const pool = await getMySqlPool();
    const createdAt = toMysqlDateTime(new Date());
    const records = input.map((item) => ({
      id: generateId("qoe"),
      createdAt,
      ...item,
    }));
    for (const record of records) {
      await pool.execute(
        `INSERT INTO qoe_events
         (id, playback_session_id, user_id, profile_id, course_id, lesson_id, event_type, event_ts, position_ms, bitrate_kbps, rebuffer_ms, peer_hit_ratio, error_code, device_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.playbackSessionId,
          record.userId,
          record.profileId,
          record.courseId,
          record.lessonId,
          record.type,
          toMysqlDateTime(record.eventTs),
          record.positionMs,
          record.bitrateKbps ?? null,
          record.rebufferMs ?? null,
          record.peerHitRatio ?? null,
          record.errorCode ?? null,
          record.deviceId,
          record.createdAt,
        ],
      );
    }
    return records.map((record) => ({
      ...record,
      createdAt: new Date(record.createdAt.replace(" ", "T") + "Z").toISOString(),
    }));
  },
};
