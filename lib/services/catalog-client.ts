import type { HomeRail, TitleSummary } from "@/lib/contracts/catalog";
import { getContentRepository } from "@/lib/repositories";
import { buildLocalTitleSummary } from "@/lib/server/catalog-view-model";
import { requestJson, ServiceError } from "@/lib/services/http-client";
import { getCatalogById, getMockCatalogRailData } from "@/lib/services/mock-data";
import { allowMockFallback } from "@/lib/services/runtime";

export async function getCatalogRails(region: string): Promise<HomeRail[]> {
  const baseUrl = process.env.CATALOG_SERVICE_URL;
  const token = process.env.SERVICE_AUTH_TOKEN;
  if (!baseUrl && !allowMockFallback()) {
    throw new ServiceError("catalog", 503, "Catalog service is not configured");
  }
  if (!baseUrl) return getMockCatalogRailData();
  return requestJson<HomeRail[]>({
    service: "catalog",
    baseUrl,
    token,
    path: `/v1/catalog/home?region=${encodeURIComponent(region)}`,
  });
}

export async function getTitleById(titleId: string): Promise<TitleSummary | null> {
  const repository = getContentRepository();
  const localCourse = await repository.getCourseRecordById(titleId);
  if (localCourse && localCourse.publishStatus === "published") {
    const [mainLesson] = await repository.listLessonRecordsByCourse(localCourse.id);
    if (mainLesson && mainLesson.publishStatus === "published") {
      return buildLocalTitleSummary(localCourse, mainLesson);
    }
  }

  const localLesson = await repository.getLessonRecordById(titleId);
  if (localLesson && localLesson.publishStatus === "published") {
    const course = await repository.getCourseRecordById(localLesson.courseId);
    if (course && course.publishStatus === "published") {
      return buildLocalTitleSummary(course, localLesson);
    }
  }

  const baseUrl = process.env.CATALOG_SERVICE_URL;
  const token = process.env.SERVICE_AUTH_TOKEN;
  if (!baseUrl && !allowMockFallback()) {
    throw new ServiceError("catalog", 503, "Catalog service is not configured");
  }
  if (!baseUrl) return getCatalogById(titleId) ?? null;
  return requestJson<TitleSummary>({
    service: "catalog",
    baseUrl,
    token,
    path: `/v1/catalog/titles/${encodeURIComponent(titleId)}`,
  });
}
