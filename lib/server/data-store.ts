import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";

import { normalizeUserRole } from "@/lib/auth/capabilities";
import type {
  FilmCategory,
  FilmCourseRecord,
  FilmLessonRecord,
  FilmMediaAsset,
  FilmVideo,
} from "@/lib/contracts/admin";
import type {
  CourseEnrollmentRecord,
  LessonProgressRecord,
  PlaybackSessionRecord,
  QoeEventRecord,
} from "@/lib/contracts/activity";
import type { CreatorPayoutLedgerRecord } from "@/lib/contracts/revenue";
import type { CreatorApplicationRecord, CreatorApplicationStatus } from "@/lib/contracts/creator-application";
import type { UserProfile, UserRole } from "@/lib/contracts/profile";
import {
  buildMainLessonInput,
  buildVideoCompatibilityRecord,
  normalizeLegacyVideos,
} from "@/lib/server/course-write-model";
import { normalizeVideoRecord } from "@/lib/server/publishing-model";

type DataState = {
  profiles: Record<string, UserProfile>;
  categories: FilmCategory[];
  courses: FilmCourseRecord[];
  lessons: FilmLessonRecord[];
  mediaAssets: FilmMediaAsset[];
  lessonProgress: LessonProgressRecord[];
  courseEnrollments: CourseEnrollmentRecord[];
  playbackSessions: PlaybackSessionRecord[];
  qoeEvents: QoeEventRecord[];
  creatorPayoutLedger: CreatorPayoutLedgerRecord[];
  creatorApplications: CreatorApplicationRecord[];
};

const DATA_FILE = `${process.cwd()}/data/app-data.json`;

const initialState: DataState = {
  profiles: {},
  categories: [],
  courses: [],
  lessons: [],
  mediaAssets: [],
  lessonProgress: [],
  courseEnrollments: [],
  playbackSessions: [],
  qoeEvents: [],
  creatorPayoutLedger: [],
  creatorApplications: [],
};

async function ensureDataFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(initialState, null, 2), "utf8");
  }
}

async function loadState(): Promise<DataState> {
  await ensureDataFile();
  const raw = await readFile(DATA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as DataState & { videos?: FilmVideo[] };
    const profiles = Object.fromEntries(
      Object.entries(parsed.profiles ?? {}).map(([userId, profile]) => [
        userId,
        {
          ...profile,
          role: normalizeUserRole(profile?.role),
        },
      ]),
    ) as Record<string, UserProfile>;
    const parsedCourses = parsed.courses ?? [];
    const parsedLessons = parsed.lessons ?? [];
    const normalizedLegacyVideos = normalizeLegacyVideos(
      (parsed.videos ?? []).map((video) => normalizeVideoRecord(video)),
    );
    const courses = parsedCourses.length > 0 ? parsedCourses : normalizedLegacyVideos.courses;
    const lessons = parsedLessons.length > 0 ? parsedLessons : normalizedLegacyVideos.lessons;

    return {
      profiles,
      categories: parsed.categories ?? [],
      courses,
      lessons,
      mediaAssets: parsed.mediaAssets ?? [],
      lessonProgress: parsed.lessonProgress ?? [],
      courseEnrollments: parsed.courseEnrollments ?? [],
      playbackSessions: parsed.playbackSessions ?? [],
      qoeEvents: parsed.qoeEvents ?? [],
      creatorPayoutLedger: parsed.creatorPayoutLedger ?? [],
      creatorApplications: parsed.creatorApplications ?? [],
    };
  } catch {
    return initialState;
  }
}

async function saveState(state: DataState) {
  await writeFile(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const state = await loadState();
  return state.profiles[userId] ?? null;
}

export async function listProfilesByRole(role: UserRole): Promise<UserProfile[]> {
  const state = await loadState();
  return Object.values(state.profiles)
    .filter((profile) => profile.role === role)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function upsertProfile(profile: UserProfile): Promise<UserProfile> {
  const state = await loadState();
  state.profiles[profile.userId] = profile;
  await saveState(state);
  return profile;
}

export async function listCategories(): Promise<FilmCategory[]> {
  const state = await loadState();
  return state.categories;
}

export async function addCategory(input: Omit<FilmCategory, "id" | "createdAt">): Promise<FilmCategory> {
  const state = await loadState();
  const category: FilmCategory = {
    id: `cat_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.categories.push(category);
  await saveState(state);
  return category;
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<FilmCategory, "name" | "description">>,
): Promise<FilmCategory | null> {
  const state = await loadState();
  const index = state.categories.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const current = state.categories[index];
  const updated: FilmCategory = {
    ...current,
    ...(typeof patch.name === "string" ? { name: patch.name } : {}),
    ...(typeof patch.description === "string" ? { description: patch.description } : {}),
  };
  state.categories[index] = updated;
  await saveState(state);
  return updated;
}

export async function deleteCategory(id: string): Promise<{ ok: boolean; reason?: string }> {
  const state = await loadState();
  const hasLinkedVideos = state.courses.some((item) => item.categoryId === id);
  if (hasLinkedVideos) {
    return { ok: false, reason: "Category is used by one or more videos" };
  }
  const initialLength = state.categories.length;
  state.categories = state.categories.filter((item) => item.id !== id);
  if (state.categories.length === initialLength) {
    return { ok: false, reason: "Category not found" };
  }
  await saveState(state);
  return { ok: true };
}

export async function listVideos(): Promise<FilmVideo[]> {
  const state = await loadState();
  return state.courses
    .map((course) => {
      const lesson = state.lessons.find((item) => item.courseId === course.id);
      return lesson ? buildVideoCompatibilityRecord(course, lesson) : null;
    })
    .filter((item): item is FilmVideo => Boolean(item));
}

export async function addVideo(input: Omit<FilmVideo, "id" | "createdAt">): Promise<FilmVideo> {
  const state = await loadState();
  const createdAt = new Date().toISOString();
  const course: FilmCourseRecord = {
    id: `vid_${crypto.randomUUID().slice(0, 8)}`,
    createdAt,
    creatorProfileId: undefined,
    title: input.title,
    synopsis: input.synopsis,
    year: input.year,
    categoryId: input.categoryId,
    heroImageUrl: input.heroImageUrl,
    cardImageUrl: input.cardImageUrl,
    publishStatus: input.publishStatus,
  };
  const lesson = buildMainLessonInput({
    id: course.id,
    title: input.title,
    synopsis: input.synopsis,
    durationMin: input.durationMin,
    maturityRating: input.maturityRating,
    manifestBlobKey: input.manifestBlobKey,
    streamAssetId: input.streamAssetId,
    publishStatus: input.publishStatus,
    createdAt,
  });
  state.courses.push(course);
  state.lessons.push(lesson);
  await saveState(state);
  return buildVideoCompatibilityRecord(course, lesson);
}

export async function updateVideo(
  id: string,
  patch: Partial<Omit<FilmVideo, "id" | "createdAt">>,
): Promise<FilmVideo | null> {
  const state = await loadState();
  const courseIndex = state.courses.findIndex((item) => item.id === id);
  const lessonIndex = state.lessons.findIndex((item) => item.courseId === id);
  if (courseIndex < 0 || lessonIndex < 0) return null;

  const currentCourse = state.courses[courseIndex];
  const currentLesson = state.lessons[lessonIndex];
  const updatedCourse: FilmCourseRecord = {
    ...currentCourse,
    ...(typeof patch.title === "string" ? { title: patch.title } : {}),
    ...(typeof patch.synopsis === "string" ? { synopsis: patch.synopsis } : {}),
    ...(typeof patch.year === "number" ? { year: patch.year } : {}),
    ...(typeof patch.categoryId === "string" ? { categoryId: patch.categoryId } : {}),
    ...(typeof patch.heroImageUrl === "string" ? { heroImageUrl: patch.heroImageUrl } : {}),
    ...(typeof patch.cardImageUrl === "string" ? { cardImageUrl: patch.cardImageUrl } : {}),
    ...(patch.publishStatus ? { publishStatus: patch.publishStatus } : {}),
  };
  const updatedLesson: FilmLessonRecord = {
    ...currentLesson,
    ...(typeof patch.title === "string" ? { title: `${patch.title} • Main Lesson` } : {}),
    ...(typeof patch.synopsis === "string" ? { synopsis: patch.synopsis } : {}),
    ...(typeof patch.durationMin === "number" ? { durationMin: patch.durationMin } : {}),
    ...(typeof patch.maturityRating === "string" ? { maturityRating: patch.maturityRating } : {}),
    ...(typeof patch.manifestBlobKey === "string" ? { manifestBlobKey: patch.manifestBlobKey } : {}),
    ...(typeof patch.streamAssetId === "string" ? { streamAssetId: patch.streamAssetId } : {}),
    ...(patch.publishStatus ? { publishStatus: patch.publishStatus } : {}),
  };
  state.courses[courseIndex] = updatedCourse;
  state.lessons[lessonIndex] = updatedLesson;
  await saveState(state);
  return buildVideoCompatibilityRecord(updatedCourse, updatedLesson);
}

export async function deleteVideo(id: string): Promise<boolean> {
  const state = await loadState();
  const initialCourseLength = state.courses.length;
  state.courses = state.courses.filter((item) => item.id !== id);
  state.lessons = state.lessons.filter((item) => item.courseId !== id);
  if (state.courses.length === initialCourseLength) {
    return false;
  }
  await saveState(state);
  return true;
}

export async function listCourseRecords(): Promise<FilmCourseRecord[]> {
  const state = await loadState();
  return state.courses;
}

export async function addCourseRecord(
  input: Omit<FilmCourseRecord, "id" | "createdAt">,
): Promise<FilmCourseRecord> {
  const state = await loadState();
  const course: FilmCourseRecord = {
    id: `vid_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.courses.push(course);
  await saveState(state);
  return course;
}

export async function getCourseRecordById(id: string): Promise<FilmCourseRecord | null> {
  const state = await loadState();
  return state.courses.find((item) => item.id === id) ?? null;
}

export async function updateCourseRecord(
  id: string,
  patch: Partial<Omit<FilmCourseRecord, "id" | "createdAt">>,
): Promise<FilmCourseRecord | null> {
  const state = await loadState();
  const index = state.courses.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const updated: FilmCourseRecord = {
    ...state.courses[index],
    ...patch,
  };
  state.courses[index] = updated;
  await saveState(state);
  return updated;
}

export async function deleteCourseRecord(id: string): Promise<boolean> {
  const state = await loadState();
  const initialLength = state.courses.length;
  state.courses = state.courses.filter((item) => item.id !== id);
  state.lessons = state.lessons.filter((item) => item.courseId !== id);
  if (state.courses.length === initialLength) {
    return false;
  }
  await saveState(state);
  return true;
}

export async function listLessonRecords(): Promise<FilmLessonRecord[]> {
  const state = await loadState();
  return state.lessons;
}

export async function addLessonRecord(
  input: Omit<FilmLessonRecord, "id" | "createdAt">,
): Promise<FilmLessonRecord> {
  const state = await loadState();
  const lesson: FilmLessonRecord = {
    id: `lesson_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.lessons.push(lesson);
  await saveState(state);
  return lesson;
}

export async function listLessonRecordsByCourse(courseId: string): Promise<FilmLessonRecord[]> {
  const state = await loadState();
  return state.lessons.filter((item) => item.courseId === courseId);
}

export async function getLessonRecordById(id: string): Promise<FilmLessonRecord | null> {
  const state = await loadState();
  return state.lessons.find((item) => item.id === id) ?? null;
}

export async function updateLessonRecord(
  id: string,
  patch: Partial<Omit<FilmLessonRecord, "id" | "createdAt" | "courseId">>,
): Promise<FilmLessonRecord | null> {
  const state = await loadState();
  const index = state.lessons.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const updated: FilmLessonRecord = {
    ...state.lessons[index],
    ...patch,
  };
  state.lessons[index] = updated;
  await saveState(state);
  return updated;
}

export async function deleteLessonRecord(id: string): Promise<boolean> {
  const state = await loadState();
  const initialLength = state.lessons.length;
  state.lessons = state.lessons.filter((item) => item.id !== id);
  if (state.lessons.length === initialLength) {
    return false;
  }
  await saveState(state);
  return true;
}

export async function listMediaAssets(): Promise<FilmMediaAsset[]> {
  const state = await loadState();
  return state.mediaAssets;
}

export async function addMediaAsset(
  input: Omit<FilmMediaAsset, "id" | "createdAt">,
): Promise<FilmMediaAsset> {
  const state = await loadState();
  const asset: FilmMediaAsset = {
    id: `asset_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.mediaAssets.push(asset);
  await saveState(state);
  return asset;
}

export async function listLessonProgressByUser(userId: string): Promise<LessonProgressRecord[]> {
  const state = await loadState();
  return state.lessonProgress
    .filter((item) => item.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function listAllLessonProgress(): Promise<LessonProgressRecord[]> {
  const state = await loadState();
  return [...state.lessonProgress].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function upsertLessonProgress(
  input: Omit<LessonProgressRecord, "id" | "updatedAt" | "completedAt"> & { completedAt?: string },
): Promise<LessonProgressRecord> {
  const state = await loadState();
  const index = state.lessonProgress.findIndex(
    (item) => item.userId === input.userId && item.lessonId === input.lessonId,
  );
  const updatedAt = new Date().toISOString();
  const record: LessonProgressRecord =
    index >= 0
      ? {
          ...state.lessonProgress[index],
          ...input,
          updatedAt,
        }
      : {
          id: `prog_${crypto.randomUUID().slice(0, 8)}`,
          updatedAt,
          ...input,
        };
  if (index >= 0) {
    state.lessonProgress[index] = record;
  } else {
    state.lessonProgress.push(record);
  }
  await saveState(state);
  return record;
}

export async function listCourseEnrollmentsByUser(userId: string): Promise<CourseEnrollmentRecord[]> {
  const state = await loadState();
  return state.courseEnrollments
    .filter((item) => item.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function upsertCourseEnrollment(
  input: Omit<CourseEnrollmentRecord, "id" | "createdAt" | "updatedAt">,
): Promise<CourseEnrollmentRecord> {
  const state = await loadState();
  const index = state.courseEnrollments.findIndex(
    (item) => item.userId === input.userId && item.courseId === input.courseId,
  );
  const now = new Date().toISOString();
  const record: CourseEnrollmentRecord =
    index >= 0
      ? {
          ...state.courseEnrollments[index],
          ...input,
          updatedAt: now,
        }
      : {
          id: `enr_${crypto.randomUUID().slice(0, 8)}`,
          createdAt: now,
          updatedAt: now,
          ...input,
        };
  if (index >= 0) {
    state.courseEnrollments[index] = record;
  } else {
    state.courseEnrollments.push(record);
  }
  await saveState(state);
  return record;
}

export async function createPlaybackSessionRecord(
  input: Omit<PlaybackSessionRecord, "createdAt">,
): Promise<PlaybackSessionRecord> {
  const state = await loadState();
  const record: PlaybackSessionRecord = {
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.playbackSessions.push(record);
  await saveState(state);
  return record;
}

export async function listAllPlaybackSessionRecords(): Promise<PlaybackSessionRecord[]> {
  const state = await loadState();
  return [...state.playbackSessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getPlaybackSessionRecordById(id: string): Promise<PlaybackSessionRecord | null> {
  const state = await loadState();
  return state.playbackSessions.find((item) => item.id === id) ?? null;
}

export async function listAllQoeEventRecords(): Promise<QoeEventRecord[]> {
  const state = await loadState();
  return [...state.qoeEvents].sort((left, right) => right.eventTs.localeCompare(left.eventTs));
}

export async function createQoeEventRecords(
  input: Array<Omit<QoeEventRecord, "id" | "createdAt">>,
): Promise<QoeEventRecord[]> {
  const state = await loadState();
  const createdAt = new Date().toISOString();
  const records = input.map((item) => ({
    id: `qoe_${crypto.randomUUID().slice(0, 8)}`,
    createdAt,
    ...item,
  }));
  state.qoeEvents.push(...records);
  await saveState(state);
  return records;
}

export async function listCreatorPayoutLedger(): Promise<CreatorPayoutLedgerRecord[]> {
  const state = await loadState();
  return [...state.creatorPayoutLedger].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function upsertCreatorPayoutLedgerRecord(
  input: Omit<CreatorPayoutLedgerRecord, "id" | "updatedAt"> & { id?: string },
): Promise<CreatorPayoutLedgerRecord> {
  const state = await loadState();
  const index = state.creatorPayoutLedger.findIndex(
    (item) =>
      item.creatorProfileId === input.creatorProfileId &&
      item.courseId === input.courseId &&
      item.periodKey === input.periodKey &&
      item.sourceType === input.sourceType &&
      item.status === input.status,
  );
  const updatedAt = new Date().toISOString();
  const record: CreatorPayoutLedgerRecord =
    index >= 0
      ? {
          ...state.creatorPayoutLedger[index],
          ...input,
          updatedAt,
        }
      : {
          id: input.id ?? `ledger_${crypto.randomUUID().slice(0, 8)}`,
          updatedAt,
          ...input,
        };
  if (index >= 0) {
    state.creatorPayoutLedger[index] = record;
  } else {
    state.creatorPayoutLedger.push(record);
  }
  await saveState(state);
  return record;
}

export async function updateCreatorPayoutLedgerStatus(
  id: string,
  status: "projected" | "settled",
): Promise<CreatorPayoutLedgerRecord | null> {
  const state = await loadState();
  const index = state.creatorPayoutLedger.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const updated: CreatorPayoutLedgerRecord = {
    ...state.creatorPayoutLedger[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  state.creatorPayoutLedger[index] = updated;
  await saveState(state);
  return updated;
}

export async function listCreatorApplications(): Promise<CreatorApplicationRecord[]> {
  const state = await loadState();
  return [...state.creatorApplications].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function listCreatorApplicationsByUser(userId: string): Promise<CreatorApplicationRecord[]> {
  const state = await loadState();
  return state.creatorApplications
    .filter((item) => item.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createCreatorApplication(
  input: Omit<CreatorApplicationRecord, "id" | "status" | "createdAt" | "updatedAt" | "reviewedByUserId" | "reviewedAt">,
): Promise<CreatorApplicationRecord> {
  const state = await loadState();
  const now = new Date().toISOString();
  const record: CreatorApplicationRecord = {
    id: `creator_app_${crypto.randomUUID().slice(0, 8)}`,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  state.creatorApplications.push(record);
  await saveState(state);
  return record;
}

export async function updateCreatorApplicationStatus(
  id: string,
  input: { status: CreatorApplicationStatus; reviewedByUserId: string },
): Promise<CreatorApplicationRecord | null> {
  const state = await loadState();
  const index = state.creatorApplications.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const updated: CreatorApplicationRecord = {
    ...state.creatorApplications[index],
    status: input.status,
    reviewedByUserId: input.reviewedByUserId,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.creatorApplications[index] = updated;
  await saveState(state);
  return updated;
}
