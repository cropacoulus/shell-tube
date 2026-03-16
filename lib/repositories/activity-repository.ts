import type {
  CourseEnrollmentRecord,
  LessonProgressRecord,
  PlaybackSessionRecord,
  QoeEventRecord,
} from "@/lib/contracts/activity";

export type ActivityRepository = {
  listAllLessonProgress(): Promise<LessonProgressRecord[]>;
  listLessonProgressByUser(userId: string): Promise<LessonProgressRecord[]>;
  upsertLessonProgress(
    input: Omit<LessonProgressRecord, "id" | "updatedAt" | "completedAt"> & {
      completedAt?: string;
    },
  ): Promise<LessonProgressRecord>;
  listCourseEnrollmentsByUser(userId: string): Promise<CourseEnrollmentRecord[]>;
  upsertCourseEnrollment(
    input: Omit<CourseEnrollmentRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<CourseEnrollmentRecord>;
  listAllPlaybackSessionRecords(): Promise<PlaybackSessionRecord[]>;
  createPlaybackSessionRecord(
    input: Omit<PlaybackSessionRecord, "createdAt">,
  ): Promise<PlaybackSessionRecord>;
  getPlaybackSessionRecordById(id: string): Promise<PlaybackSessionRecord | null>;
  listAllQoeEventRecords(): Promise<QoeEventRecord[]>;
  createQoeEventRecords(
    input: Array<Omit<QoeEventRecord, "id" | "createdAt">>,
  ): Promise<QoeEventRecord[]>;
};
