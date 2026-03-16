import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getContentRepository } from "@/lib/repositories";

type LessonCreateRequest = {
  courseId: string;
  title: string;
  synopsis: string;
  durationMin: number;
  maturityRating: string;
  manifestBlobKey: string;
  streamAssetId?: string;
  publishStatus: "draft" | "published";
};

type LessonPatchRequest = {
  id: string;
  title?: string;
  synopsis?: string;
  durationMin?: number;
  maturityRating?: string;
  manifestBlobKey?: string;
  streamAssetId?: string;
  publishStatus?: "draft" | "published";
};

type LessonDeleteRequest = {
  id: string;
};

function isValid(body: unknown): body is LessonCreateRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.courseId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.synopsis === "string" &&
    typeof candidate.durationMin === "number" &&
    typeof candidate.maturityRating === "string" &&
    typeof candidate.manifestBlobKey === "string" &&
    (candidate.streamAssetId === undefined || typeof candidate.streamAssetId === "string") &&
    (candidate.publishStatus === "draft" || candidate.publishStatus === "published")
  );
}

function ensureAdmin(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return { ok: false as const, response: jsonError("UNAUTHORIZED", "Session is required", 401) };
  if (auth.role !== "admin") return { ok: false as const, response: jsonError("FORBIDDEN", "Admin access required", 403) };
  return { ok: true as const };
}

export async function GET(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const repository = getContentRepository();
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (courseId) {
    return jsonOk(await repository.listLessonRecordsByCourse(courseId));
  }
  return jsonOk(await repository.listLessonRecords());
}

export async function POST(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const repository = getContentRepository();

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body)) return jsonError("INVALID_REQUEST", "Invalid lesson payload", 422);
  const course = await repository.getCourseRecordById(body.courseId);
  if (!course) return jsonError("INVALID_REQUEST", "courseId does not exist", 422);
  if (!body.manifestBlobKey.trim()) {
    return jsonError("INVALID_REQUEST", "Stream blob key is required", 422);
  }
  return jsonOk(await repository.addLessonRecord(body), 201);
}

export async function PATCH(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => null)) as LessonPatchRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Lesson id is required", 422);
  }

  const patch: Omit<LessonPatchRequest, "id"> = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.synopsis === "string") patch.synopsis = body.synopsis;
  if (typeof body.durationMin === "number") patch.durationMin = body.durationMin;
  if (typeof body.maturityRating === "string") patch.maturityRating = body.maturityRating;
  if (typeof body.manifestBlobKey === "string") patch.manifestBlobKey = body.manifestBlobKey;
  if (typeof body.streamAssetId === "string") patch.streamAssetId = body.streamAssetId;
  if (body.publishStatus === "draft" || body.publishStatus === "published") {
    patch.publishStatus = body.publishStatus;
  }
  if (Object.keys(patch).length === 0) {
    return jsonError("INVALID_REQUEST", "At least one field must be updated", 422);
  }
  if (typeof patch.manifestBlobKey === "string" && !patch.manifestBlobKey.trim()) {
    return jsonError("INVALID_REQUEST", "Stream blob key cannot be empty", 422);
  }
  const updated = await getContentRepository().updateLessonRecord(body.id, patch);
  if (!updated) return jsonError("NOT_FOUND", "Lesson not found", 404);
  return jsonOk(updated);
}

export async function DELETE(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => null)) as LessonDeleteRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Lesson id is required", 422);
  }
  const deleted = await getContentRepository().deleteLessonRecord(body.id);
  if (!deleted) return jsonError("NOT_FOUND", "Lesson not found", 404);
  return jsonOk({ deleted: true });
}
