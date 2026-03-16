import type { ActivityRepository } from "@/lib/repositories/activity-repository";
import {
  createPlaybackSessionRecord,
  createQoeEventRecords,
  getPlaybackSessionRecordById,
  listAllLessonProgress,
  listAllPlaybackSessionRecords,
  listAllQoeEventRecords,
  listCourseEnrollmentsByUser,
  listLessonProgressByUser,
  upsertCourseEnrollment,
  upsertLessonProgress,
} from "@/lib/server/data-store";

export const jsonActivityRepository: ActivityRepository = {
  listAllLessonProgress,
  listLessonProgressByUser,
  upsertLessonProgress,
  listCourseEnrollmentsByUser,
  upsertCourseEnrollment,
  listAllPlaybackSessionRecords,
  createPlaybackSessionRecord,
  getPlaybackSessionRecordById,
  listAllQoeEventRecords,
  createQoeEventRecords,
};
