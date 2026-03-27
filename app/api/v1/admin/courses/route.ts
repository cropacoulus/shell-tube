import { getAuthContextFromRequest } from "@/lib/server/auth";
import type { FilmCourseRecord } from "@/lib/contracts/admin";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { listCategoriesFromProjection } from "@/lib/projections/category-read-model";
import { getCourseRecordFromProjection, listCourseRecordsFromProjection } from "@/lib/projections/admin-record-read-model";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getContentRepository, getEventStore } from "@/lib/repositories";

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
  const optionB = createOptionBConfig();
  return jsonOk(
    optionB.projectionStoreBackend === "upstash"
      ? await listCourseRecordsFromProjection()
      : await getContentRepository().listCourseRecords(),
  );
}

export async function POST(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body)) return jsonError("INVALID_REQUEST", "Invalid course payload", 422);

  const optionB = createOptionBConfig();
  const repository = getContentRepository();
  const categories = optionB.projectionStoreBackend === "upstash"
    ? await listCategoriesFromProjection()
    : await repository.listCategories();
  if (!categories.find((item) => item.id === body.categoryId)) {
    return jsonError("INVALID_REQUEST", "categoryId does not exist", 422);
  }

  const created: FilmCourseRecord = optionB.projectionStoreBackend === "upstash"
    ? {
        id: `course_${crypto.randomUUID().slice(0, 12)}`,
        creatorProfileId: body.creatorProfileId ?? gate.auth.profileId,
        title: body.title,
        synopsis: body.synopsis,
        year: body.year,
        categoryId: body.categoryId,
        heroImageUrl: body.heroImageUrl,
        cardImageUrl: body.cardImageUrl,
        publishStatus: body.publishStatus,
        createdAt: new Date().toISOString(),
      }
    : await repository.addCourseRecord({
        ...body,
        creatorProfileId: body.creatorProfileId ?? gate.auth.profileId,
      });
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "course_created",
      aggregateType: "course",
      aggregateId: created.id,
      actor: { userId: gate.auth.userId, role: gate.auth.role },
      idempotencyKey: buildEventIdempotencyKey("admin-course-create", created.id),
      payload: {
        courseId: created.id,
        creatorProfileId: created.creatorProfileId,
        title: created.title,
        synopsis: created.synopsis,
        year: created.year,
        categoryId: created.categoryId,
        heroImageUrl: created.heroImageUrl,
        cardImageUrl: created.cardImageUrl,
        publishStatus: created.publishStatus,
        createdAt: created.createdAt,
        updatedAt: created.createdAt,
      },
    }),
  );
  await runProjectionBatch(200);
  return jsonOk(created, 201);
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
  const optionB = createOptionBConfig();
  if (typeof patch.categoryId === "string") {
    const categories = optionB.projectionStoreBackend === "upstash"
      ? await listCategoriesFromProjection()
      : await getContentRepository().listCategories();
    if (!categories.find((item) => item.id === patch.categoryId)) {
      return jsonError("INVALID_REQUEST", "categoryId does not exist", 422);
    }
  }

  const updated: FilmCourseRecord | null = optionB.projectionStoreBackend === "upstash"
    ? await (async () => {
        const existing = await getCourseRecordFromProjection(body.id);
        if (!existing) return null;
        return {
          ...existing,
          ...patch,
        };
      })()
    : await getContentRepository().updateCourseRecord(body.id, patch);
  if (!updated) return jsonError("NOT_FOUND", "Course not found", 404);
  const updatedAt = new Date().toISOString();
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "course_updated",
      aggregateType: "course",
      aggregateId: updated.id,
      actor: { userId: gate.auth.userId, role: gate.auth.role },
      idempotencyKey: buildEventIdempotencyKey("admin-course-update", updated.id, updatedAt),
      payload: {
        courseId: updated.id,
        creatorProfileId: updated.creatorProfileId,
        title: updated.title,
        synopsis: updated.synopsis,
        year: updated.year,
        categoryId: updated.categoryId,
        heroImageUrl: updated.heroImageUrl,
        cardImageUrl: updated.cardImageUrl,
        publishStatus: updated.publishStatus,
        createdAt: updated.createdAt,
        updatedAt,
      },
    }),
  );
  await runProjectionBatch(200);
  return jsonOk(updated);
}

export async function DELETE(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as CourseDeleteRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Course id is required", 422);
  }
  const optionB = createOptionBConfig();
  if (optionB.projectionStoreBackend !== "upstash") {
    const deleted = await getContentRepository().deleteCourseRecord(body.id);
    if (!deleted) return jsonError("NOT_FOUND", "Course not found", 404);
  }
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "course_deleted",
      aggregateType: "course",
      aggregateId: body.id,
      actor: { userId: gate.auth.userId, role: gate.auth.role },
      idempotencyKey: buildEventIdempotencyKey("admin-course-delete", body.id),
      payload: { courseId: body.id },
    }),
  );
  await runProjectionBatch(200);
  return jsonOk({ deleted: true });
}
