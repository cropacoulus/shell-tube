import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getContentRepository } from "@/lib/repositories";

type CourseCreateRequest = {
  creatorProfileId?: string;
  title: string;
  synopsis: string;
  year: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  publishStatus: "draft" | "published";
};

type CoursePatchRequest = {
  id: string;
  creatorProfileId?: string;
  title?: string;
  synopsis?: string;
  year?: number;
  categoryId?: string;
  heroImageUrl?: string;
  cardImageUrl?: string;
  publishStatus?: "draft" | "published";
};

type CourseDeleteRequest = {
  id: string;
};

function isValid(body: unknown): body is CourseCreateRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.synopsis === "string" &&
    typeof candidate.year === "number" &&
    typeof candidate.categoryId === "string" &&
    typeof candidate.heroImageUrl === "string" &&
    typeof candidate.cardImageUrl === "string" &&
    (candidate.publishStatus === "draft" || candidate.publishStatus === "published")
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
  return jsonOk(await getContentRepository().listCourseRecords());
}

export async function POST(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body)) return jsonError("INVALID_REQUEST", "Invalid course payload", 422);

  const repository = getContentRepository();
  const categories = await repository.listCategories();
  if (!categories.find((item) => item.id === body.categoryId)) {
    return jsonError("INVALID_REQUEST", "categoryId does not exist", 422);
  }

  return jsonOk(
    await repository.addCourseRecord({
      ...body,
      creatorProfileId: body.creatorProfileId ?? gate.auth.profileId,
    }),
    201,
  );
}

export async function PATCH(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as CoursePatchRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Course id is required", 422);
  }

  const patch: Omit<CoursePatchRequest, "id"> = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.creatorProfileId === "string") patch.creatorProfileId = body.creatorProfileId;
  if (typeof body.synopsis === "string") patch.synopsis = body.synopsis;
  if (typeof body.year === "number") patch.year = body.year;
  if (typeof body.categoryId === "string") patch.categoryId = body.categoryId;
  if (typeof body.heroImageUrl === "string") patch.heroImageUrl = body.heroImageUrl;
  if (typeof body.cardImageUrl === "string") patch.cardImageUrl = body.cardImageUrl;
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

  const updated = await getContentRepository().updateCourseRecord(body.id, patch);
  if (!updated) return jsonError("NOT_FOUND", "Course not found", 404);
  return jsonOk(updated);
}

export async function DELETE(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as CourseDeleteRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Course id is required", 422);
  }
  const deleted = await getContentRepository().deleteCourseRecord(body.id);
  if (!deleted) return jsonError("NOT_FOUND", "Course not found", 404);
  return jsonOk({ deleted: true });
}
