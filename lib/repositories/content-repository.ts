import type {
  FilmCategory,
  FilmCourseRecord,
  FilmLessonRecord,
  FilmMediaAsset,
  FilmVideo,
} from "@/lib/contracts/admin";

export type ContentRepository = {
  listCategories(): Promise<FilmCategory[]>;
  addCategory(input: Omit<FilmCategory, "id" | "createdAt">): Promise<FilmCategory>;
  updateCategory(
    id: string,
    patch: Partial<Pick<FilmCategory, "name" | "description">>,
  ): Promise<FilmCategory | null>;
  deleteCategory(id: string): Promise<{ ok: boolean; reason?: string }>;
  listVideos(): Promise<FilmVideo[]>;
  addVideo(input: Omit<FilmVideo, "id" | "createdAt">): Promise<FilmVideo>;
  updateVideo(
    id: string,
    patch: Partial<Omit<FilmVideo, "id" | "createdAt">>,
  ): Promise<FilmVideo | null>;
  deleteVideo(id: string): Promise<boolean>;
  listCourseRecords(): Promise<FilmCourseRecord[]>;
  addCourseRecord(input: Omit<FilmCourseRecord, "id" | "createdAt">): Promise<FilmCourseRecord>;
  getCourseRecordById(id: string): Promise<FilmCourseRecord | null>;
  updateCourseRecord(
    id: string,
    patch: Partial<Omit<FilmCourseRecord, "id" | "createdAt">>,
  ): Promise<FilmCourseRecord | null>;
  deleteCourseRecord(id: string): Promise<boolean>;
  listLessonRecords(): Promise<FilmLessonRecord[]>;
  addLessonRecord(input: Omit<FilmLessonRecord, "id" | "createdAt">): Promise<FilmLessonRecord>;
  listLessonRecordsByCourse(courseId: string): Promise<FilmLessonRecord[]>;
  getLessonRecordById(id: string): Promise<FilmLessonRecord | null>;
  updateLessonRecord(
    id: string,
    patch: Partial<Omit<FilmLessonRecord, "id" | "createdAt" | "courseId">>,
  ): Promise<FilmLessonRecord | null>;
  deleteLessonRecord(id: string): Promise<boolean>;
  listMediaAssets(): Promise<FilmMediaAsset[]>;
  addMediaAsset(input: Omit<FilmMediaAsset, "id" | "createdAt">): Promise<FilmMediaAsset>;
};
