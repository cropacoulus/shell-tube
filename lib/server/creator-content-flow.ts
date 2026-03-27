import { canModeratePlatform } from "../auth/capabilities.ts";
import { createOptionBConfig } from "../runtime/option-b-config.ts";
import { buildAdminContentItem, type AdminContentItem } from "./admin-content-model.ts";
import type { ContentRepository } from "../repositories/content-repository.ts";
import type { CourseSummary } from "./course-flow.ts";

export async function listCreatorOwnedCourseSummariesWithRepository(
  repository: Pick<ContentRepository, "listCategories" | "listCourseRecords">,
  input: {
    profileId: string;
    role: "student" | "creator" | "admin";
  },
): Promise<CourseSummary[]> {
  const { listCourseSummaries } = await import("./course-flow.ts");
  if (canModeratePlatform(input.role)) {
    return listCourseSummaries();
  }

  const [courses, categories] = await Promise.all([
    repository.listCourseRecords(),
    repository.listCategories(),
  ]);
  const categoryById = new Map(categories.map((item) => [item.id, item.name]));

  return courses
    .filter((course) => course.creatorProfileId === input.profileId)
    .map((course) => ({
      id: course.id,
      title: course.title,
      description: course.synopsis,
      category: categoryById.get(course.categoryId) ?? "General",
      thumbnailUrl: course.cardImageUrl || course.heroImageUrl,
      year: course.year,
    }));
}

export async function listCreatorOwnedCourseSummaries(input: {
  profileId: string;
  role: "student" | "creator" | "admin";
}): Promise<CourseSummary[]> {
  if (createOptionBConfig().projectionStoreBackend === "upstash") {
    const { listCreatorOwnedCourseSummariesFromProjection } = await import("../projections/creator-content-read-model.ts");
    return listCreatorOwnedCourseSummariesFromProjection(input);
  }

  const { getContentRepository } = await import("../repositories/index.ts");
  return listCreatorOwnedCourseSummariesWithRepository(getContentRepository(), input);
}

export async function listCreatorOwnedAdminContentItemsWithRepository(
  repository: Pick<ContentRepository, "listCourseRecords" | "listLessonRecords">,
  input: {
    profileId: string;
    role: "student" | "creator" | "admin";
  },
): Promise<AdminContentItem[]> {
  const [courses, lessons] = await Promise.all([
    repository.listCourseRecords(),
    repository.listLessonRecords(),
  ]);

  return courses
    .filter((course) => canModeratePlatform(input.role) || course.creatorProfileId === input.profileId)
    .map((course) => {
      const lesson = lessons.find((item) => item.courseId === course.id);
      return lesson ? buildAdminContentItem(course, lesson) : null;
    })
    .filter((item): item is AdminContentItem => Boolean(item));
}

export async function listCreatorOwnedAdminContentItems(input: {
  profileId: string;
  role: "student" | "creator" | "admin";
}): Promise<AdminContentItem[]> {
  if (createOptionBConfig().projectionStoreBackend === "upstash") {
    const { listCreatorOwnedAdminContentItemsFromProjection } = await import("../projections/creator-content-read-model.ts");
    return listCreatorOwnedAdminContentItemsFromProjection(input);
  }

  const { getContentRepository } = await import("../repositories/index.ts");
  return listCreatorOwnedAdminContentItemsWithRepository(getContentRepository(), input);
}

export async function canAccessCreatorCourseWithRepository(
  repository: Pick<ContentRepository, "getCourseRecordById">,
  input: {
    courseId: string;
    profileId: string;
    role: "student" | "creator" | "admin";
  },
): Promise<boolean> {
  if (canModeratePlatform(input.role)) return true;
  const course = await repository.getCourseRecordById(input.courseId);
  return Boolean(course && course.creatorProfileId === input.profileId);
}

export async function canAccessCreatorCourse(input: {
  courseId: string;
  profileId: string;
  role: "student" | "creator" | "admin";
}): Promise<boolean> {
  if (createOptionBConfig().projectionStoreBackend === "upstash") {
    const { canAccessCreatorCourseFromProjection } = await import("../projections/creator-content-read-model.ts");
    return canAccessCreatorCourseFromProjection(input);
  }

  const { getContentRepository } = await import("../repositories/index.ts");
  return canAccessCreatorCourseWithRepository(getContentRepository(), input);
}
