import { canPublishContent, canModeratePlatform } from "@/lib/auth/capabilities";
import { validateCreatorPublishState } from "@/lib/creator/content-validation";
import { getContentRepository } from "@/lib/repositories";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { buildAdminContentItem } from "@/lib/server/admin-content-model";
import { listCreatorOwnedAdminContentItems } from "@/lib/server/creator-content-flow";
import { jsonError, jsonOk } from "@/lib/server/http";

type CreatorContentCreateRequest = {
  title: string;
  synopsis: string;
  year: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  durationMin: number;
  maturityRating: string;
  manifestBlobKey?: string;
  streamAssetId?: string;
  publishStatus: "draft" | "published";
};

type CreatorContentPatchRequest = Partial<CreatorContentCreateRequest> & {
  courseId: string;
  lessonId: string;
};

type CreatorContentDeleteRequest = {
  courseId: string;
};

function isValidCreate(body: unknown): body is CreatorContentCreateRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.synopsis === "string" &&
    typeof candidate.year === "number" &&
    typeof candidate.categoryId === "string" &&
    typeof candidate.heroImageUrl === "string" &&
    typeof candidate.cardImageUrl === "string" &&
    typeof candidate.durationMin === "number" &&
    typeof candidate.maturityRating === "string" &&
    (candidate.manifestBlobKey === undefined || typeof candidate.manifestBlobKey === "string") &&
    (candidate.streamAssetId === undefined || typeof candidate.streamAssetId === "string") &&
    (candidate.publishStatus === "draft" || candidate.publishStatus === "published")
  );
}

async function ensureCreator(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return { ok: false as const, response: jsonError("UNAUTHORIZED", "Session is required", 401) };
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canPublishContent(effectiveRole)) {
    return { ok: false as const, response: jsonError("FORBIDDEN", "Creator or admin access required", 403) };
  }
  return {
    ok: true as const,
    auth: {
      ...auth,
      role: effectiveRole,
    },
  };
}

async function canManageCourse(input: { courseId: string; profileId: string; role: "student" | "creator" | "admin" }) {
  const course = await getContentRepository().getCourseRecordById(input.courseId);
  if (!course) return null;
  if (canModeratePlatform(input.role)) return course;
  return course.creatorProfileId === input.profileId ? course : null;
}

export async function GET(req: Request) {
  const gate = await ensureCreator(req);
  if (!gate.ok) return gate.response;
  return jsonOk(
    await listCreatorOwnedAdminContentItems({
      profileId: gate.auth.profileId,
      role: gate.auth.role,
    }),
  );
}

export async function POST(req: Request) {
  const gate = await ensureCreator(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValidCreate(body)) return jsonError("INVALID_REQUEST", "Invalid creator content payload", 422);
  const publishStateError = validateCreatorPublishState({
    publishStatus: body.publishStatus,
    manifestBlobKey: body.manifestBlobKey,
  });
  if (publishStateError) {
    return jsonError("INVALID_REQUEST", publishStateError, 422);
  }

  const repository = getContentRepository();
  const categories = await repository.listCategories();
  if (!categories.find((item) => item.id === body.categoryId)) {
    return jsonError("INVALID_REQUEST", "categoryId does not exist", 422);
  }

  const course = await repository.addCourseRecord({
    creatorProfileId: gate.auth.profileId,
    title: body.title,
    synopsis: body.synopsis,
    year: body.year,
    categoryId: body.categoryId,
    heroImageUrl: body.heroImageUrl,
    cardImageUrl: body.cardImageUrl,
    publishStatus: body.publishStatus,
  });
  const lesson = await repository.addLessonRecord({
    courseId: course.id,
    title: `${body.title} • Main Lesson`,
    synopsis: body.synopsis,
    durationMin: body.durationMin,
    maturityRating: body.maturityRating,
    manifestBlobKey: body.manifestBlobKey ?? "",
    streamAssetId: body.streamAssetId,
    publishStatus: body.publishStatus,
  });

  return jsonOk(buildAdminContentItem(course, lesson), 201);
}

export async function PATCH(req: Request) {
  const gate = await ensureCreator(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as CreatorContentPatchRequest | null;
  if (!body || typeof body.courseId !== "string" || typeof body.lessonId !== "string") {
    return jsonError("INVALID_REQUEST", "courseId and lessonId are required", 422);
  }

  const managedCourse = await canManageCourse({
    courseId: body.courseId,
    profileId: gate.auth.profileId,
    role: gate.auth.role,
  });
  if (!managedCourse) return jsonError("FORBIDDEN", "You do not own this course", 403);

  if (typeof body.categoryId === "string") {
    const categories = await getContentRepository().listCategories();
    if (!categories.find((item) => item.id === body.categoryId)) {
      return jsonError("INVALID_REQUEST", "categoryId does not exist", 422);
    }
  }
  const publishStateError = validateCreatorPublishState({
    publishStatus: body.publishStatus ?? managedCourse.publishStatus,
    manifestBlobKey: typeof body.manifestBlobKey === "string" ? body.manifestBlobKey : undefined,
  });
  if (publishStateError && typeof body.manifestBlobKey === "string") {
    return jsonError("INVALID_REQUEST", publishStateError, 422);
  }
  if (
    publishStateError &&
    body.publishStatus === "published"
  ) {
    const lesson = await getContentRepository().getLessonRecordById(body.lessonId);
    if (!lesson?.manifestBlobKey.trim()) {
      return jsonError("INVALID_REQUEST", publishStateError, 422);
    }
  }

  const repository = getContentRepository();
  const [updatedCourse, updatedLesson] = await Promise.all([
    repository.updateCourseRecord(body.courseId, {
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(typeof body.synopsis === "string" ? { synopsis: body.synopsis } : {}),
      ...(typeof body.year === "number" ? { year: body.year } : {}),
      ...(typeof body.categoryId === "string" ? { categoryId: body.categoryId } : {}),
      ...(typeof body.heroImageUrl === "string" ? { heroImageUrl: body.heroImageUrl } : {}),
      ...(typeof body.cardImageUrl === "string" ? { cardImageUrl: body.cardImageUrl } : {}),
      ...(body.publishStatus ? { publishStatus: body.publishStatus } : {}),
    }),
    repository.updateLessonRecord(body.lessonId, {
      ...(typeof body.title === "string" ? { title: `${body.title} • Main Lesson` } : {}),
      ...(typeof body.synopsis === "string" ? { synopsis: body.synopsis } : {}),
      ...(typeof body.durationMin === "number" ? { durationMin: body.durationMin } : {}),
      ...(typeof body.maturityRating === "string" ? { maturityRating: body.maturityRating } : {}),
      ...(typeof body.manifestBlobKey === "string" ? { manifestBlobKey: body.manifestBlobKey } : {}),
      ...(typeof body.streamAssetId === "string" ? { streamAssetId: body.streamAssetId } : {}),
      ...(body.publishStatus ? { publishStatus: body.publishStatus } : {}),
    }),
  ]);

  if (!updatedCourse || !updatedLesson) {
    return jsonError("NOT_FOUND", "Creator content not found", 404);
  }
  return jsonOk(buildAdminContentItem(updatedCourse, updatedLesson));
}

export async function DELETE(req: Request) {
  const gate = await ensureCreator(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as CreatorContentDeleteRequest | null;
  if (!body || typeof body.courseId !== "string") {
    return jsonError("INVALID_REQUEST", "courseId is required", 422);
  }

  const managedCourse = await canManageCourse({
    courseId: body.courseId,
    profileId: gate.auth.profileId,
    role: gate.auth.role,
  });
  if (!managedCourse) return jsonError("FORBIDDEN", "You do not own this course", 403);

  const deleted = await getContentRepository().deleteCourseRecord(body.courseId);
  if (!deleted) return jsonError("NOT_FOUND", "Creator content not found", 404);
  return jsonOk({ deleted: true });
}
