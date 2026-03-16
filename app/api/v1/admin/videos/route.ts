import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { buildAdminContentItem } from "@/lib/server/admin-content-model";
import { getContentRepository } from "@/lib/repositories";
import type { VideoPublishStatus } from "@/lib/contracts/admin";

type VideoCreateRequest = {
  title: string;
  synopsis: string;
  year: number;
  maturityRating: string;
  durationMin: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  manifestBlobKey: string;
  streamAssetId?: string;
  publishStatus?: VideoPublishStatus;
};

type VideoPatchRequest = {
  id: string;
  title?: string;
  synopsis?: string;
  year?: number;
  maturityRating?: string;
  durationMin?: number;
  categoryId?: string;
  heroImageUrl?: string;
  cardImageUrl?: string;
  manifestBlobKey?: string;
  streamAssetId?: string;
  publishStatus?: VideoPublishStatus;
};

type VideoDeleteRequest = {
  id: string;
};

function isValid(body: unknown): body is VideoCreateRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.synopsis === "string" &&
    typeof candidate.year === "number" &&
    typeof candidate.maturityRating === "string" &&
    typeof candidate.durationMin === "number" &&
    typeof candidate.categoryId === "string" &&
    typeof candidate.heroImageUrl === "string" &&
    typeof candidate.cardImageUrl === "string" &&
    typeof candidate.manifestBlobKey === "string" &&
    (candidate.streamAssetId === undefined || typeof candidate.streamAssetId === "string") &&
    (candidate.publishStatus === undefined ||
      candidate.publishStatus === "draft" ||
      candidate.publishStatus === "published")
  );
}

function ensureAdmin(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return { ok: false as const, response: jsonError("UNAUTHORIZED", "Session is required", 401) };
  if (auth.role !== "admin") return { ok: false as const, response: jsonError("FORBIDDEN", "Admin access required", 403) };
  return { ok: true as const, auth };
}

export async function GET(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const repository = getContentRepository();
  const [courses, lessons] = await Promise.all([
    repository.listCourseRecords(),
    repository.listLessonRecords(),
  ]);
  const items = courses
    .map((course) => {
      const lesson = lessons.find((item) => item.courseId === course.id);
      return lesson ? buildAdminContentItem(course, lesson) : null;
    })
    .filter((item): item is ReturnType<typeof buildAdminContentItem> => Boolean(item));
  return jsonOk(items);
}

export async function POST(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body)) return jsonError("INVALID_REQUEST", "Invalid video payload", 422);

  const repository = getContentRepository();
  const categories = await repository.listCategories();
  if (!categories.find((item) => item.id === body.categoryId)) {
    return jsonError("INVALID_REQUEST", "categoryId does not exist", 422);
  }
  if (!body.manifestBlobKey.trim()) {
    return jsonError(
      "INVALID_REQUEST",
      "Stream blob key is required. Upload video/manifest to Shelby first.",
      422,
    );
  }

  const course = await repository.addCourseRecord({
    title: body.title,
    synopsis: body.synopsis,
    year: body.year,
    categoryId: body.categoryId,
    heroImageUrl: body.heroImageUrl,
    cardImageUrl: body.cardImageUrl,
    publishStatus: body.publishStatus ?? "draft",
  });
  const lesson = await repository.addLessonRecord({
    courseId: course.id,
    title: `${body.title} • Main Lesson`,
    synopsis: body.synopsis,
    durationMin: body.durationMin,
    maturityRating: body.maturityRating,
    manifestBlobKey: body.manifestBlobKey,
    streamAssetId: body.streamAssetId,
    publishStatus: body.publishStatus ?? "draft",
  });
  return jsonOk(buildAdminContentItem(course, lesson), 201);
}

export async function PATCH(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as VideoPatchRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Video id is required", 422);
  }

  const patch: Omit<VideoPatchRequest, "id"> = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.synopsis === "string") patch.synopsis = body.synopsis;
  if (typeof body.year === "number") patch.year = body.year;
  if (typeof body.maturityRating === "string") patch.maturityRating = body.maturityRating;
  if (typeof body.durationMin === "number") patch.durationMin = body.durationMin;
  if (typeof body.categoryId === "string") patch.categoryId = body.categoryId;
  if (typeof body.heroImageUrl === "string") patch.heroImageUrl = body.heroImageUrl;
  if (typeof body.cardImageUrl === "string") patch.cardImageUrl = body.cardImageUrl;
  if (typeof body.manifestBlobKey === "string") patch.manifestBlobKey = body.manifestBlobKey;
  if (typeof body.streamAssetId === "string") patch.streamAssetId = body.streamAssetId;
  if (body.publishStatus === "draft" || body.publishStatus === "published") {
    patch.publishStatus = body.publishStatus;
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("INVALID_REQUEST", "At least one field must be updated", 422);
  }

  if (typeof patch.categoryId === "string") {
    const categories = await getContentRepository().listCategories();
    if (!categories.find((item) => item.id === patch.categoryId)) {
      return jsonError("INVALID_REQUEST", "categoryId does not exist", 422);
    }
  }
  if (typeof patch.manifestBlobKey === "string" && !patch.manifestBlobKey.trim()) {
    return jsonError("INVALID_REQUEST", "Stream blob key cannot be empty", 422);
  }

  const repository = getContentRepository();
  const [lesson] = await repository.listLessonRecordsByCourse(body.id);
  if (!lesson) return jsonError("NOT_FOUND", "Video not found", 404);

  const [updatedCourse, updatedLesson] = await Promise.all([
    repository.updateCourseRecord(body.id, {
      ...(typeof patch.title === "string" ? { title: patch.title } : {}),
      ...(typeof patch.synopsis === "string" ? { synopsis: patch.synopsis } : {}),
      ...(typeof patch.year === "number" ? { year: patch.year } : {}),
      ...(typeof patch.categoryId === "string" ? { categoryId: patch.categoryId } : {}),
      ...(typeof patch.heroImageUrl === "string" ? { heroImageUrl: patch.heroImageUrl } : {}),
      ...(typeof patch.cardImageUrl === "string" ? { cardImageUrl: patch.cardImageUrl } : {}),
      ...(patch.publishStatus ? { publishStatus: patch.publishStatus } : {}),
    }),
    repository.updateLessonRecord(lesson.id, {
      ...(typeof patch.title === "string" ? { title: `${patch.title} • Main Lesson` } : {}),
      ...(typeof patch.synopsis === "string" ? { synopsis: patch.synopsis } : {}),
      ...(typeof patch.durationMin === "number" ? { durationMin: patch.durationMin } : {}),
      ...(typeof patch.maturityRating === "string" ? { maturityRating: patch.maturityRating } : {}),
      ...(typeof patch.manifestBlobKey === "string" ? { manifestBlobKey: patch.manifestBlobKey } : {}),
      ...(typeof patch.streamAssetId === "string" ? { streamAssetId: patch.streamAssetId } : {}),
      ...(patch.publishStatus ? { publishStatus: patch.publishStatus } : {}),
    }),
  ]);
  if (!updatedCourse || !updatedLesson) return jsonError("NOT_FOUND", "Video not found", 404);
  return jsonOk(buildAdminContentItem(updatedCourse, updatedLesson));
}

export async function DELETE(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as VideoDeleteRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Video id is required", 422);
  }

  const deleted = await getContentRepository().deleteCourseRecord(body.id);
  if (!deleted) return jsonError("NOT_FOUND", "Video not found", 404);
  return jsonOk({ deleted: true });
}
