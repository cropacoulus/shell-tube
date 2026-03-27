import { requireAdmin } from "@/lib/blockchain/role-registry";
import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";
import type { FilmLessonRecord } from "@/lib/contracts/admin";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import {
  getCourseRecordFromProjection,
  getLessonRecordFromProjection,
  listLessonRecordsByCourseFromProjection,
  listLessonRecordsFromProjection,
} from "@/lib/projections/admin-record-read-model";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getContentRepository, getEventStore } from "@/lib/repositories";
import { requireWalletActionProof } from "@/lib/server/wallet-action-auth";

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

async function ensureAdmin(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return { ok: false as const, response: jsonError("UNAUTHORIZED", "Session is required", 401) };
  try {
    await requireAdmin(auth.userId);
  } catch {
    return { ok: false as const, response: jsonError("FORBIDDEN", "Admin access required", 403) };
  }
  return { ok: true as const, auth };
}

export async function GET(req: Request) {
  const gate = await ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const optionB = createOptionBConfig();
  const repository = getContentRepository();
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (courseId) {
    return jsonOk(
      optionB.projectionStoreBackend === "upstash"
        ? await listLessonRecordsByCourseFromProjection(courseId)
        : await repository.listLessonRecordsByCourse(courseId),
    );
  }
  return jsonOk(
    optionB.projectionStoreBackend === "upstash"
      ? await listLessonRecordsFromProjection()
      : await repository.listLessonRecords(),
  );
}

export async function POST(req: Request) {
  const gate = await ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const proof = await requireWalletActionProof(req, gate.auth.userId);
  if (!proof.ok) return proof.response;
  const repository = getContentRepository();
  const optionB = createOptionBConfig();

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body)) return jsonError("INVALID_REQUEST", "Invalid lesson payload", 422);
  const course = optionB.projectionStoreBackend === "upstash"
    ? await getCourseRecordFromProjection(body.courseId)
    : await repository.getCourseRecordById(body.courseId);
  if (!course) return jsonError("INVALID_REQUEST", "courseId does not exist", 422);
  if (!body.manifestBlobKey.trim()) {
    return jsonError("INVALID_REQUEST", "Stream blob key is required", 422);
  }
  const created: FilmLessonRecord = optionB.projectionStoreBackend === "upstash"
    ? {
        id: `lesson_${crypto.randomUUID().slice(0, 12)}`,
        courseId: body.courseId,
        title: body.title,
        synopsis: body.synopsis,
        durationMin: body.durationMin,
        maturityRating: body.maturityRating,
        manifestBlobKey: body.manifestBlobKey,
        streamAssetId: body.streamAssetId,
        publishStatus: body.publishStatus,
        createdAt: new Date().toISOString(),
      }
    : await repository.addLessonRecord(body);
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "lesson_created",
      aggregateType: "lesson",
      aggregateId: created.id,
      actor: { userId: gate.auth.userId, role: gate.auth.role },
      idempotencyKey: buildEventIdempotencyKey("admin-lesson-create", created.id),
      payload: {
        lessonId: created.id,
        courseId: created.courseId,
        title: created.title,
        synopsis: created.synopsis,
        durationMin: created.durationMin,
        maturityRating: created.maturityRating,
        manifestBlobKey: created.manifestBlobKey,
        streamAssetId: created.streamAssetId,
        processingStatus: created.processingStatus,
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
  const gate = await ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const proof = await requireWalletActionProof(req, gate.auth.userId);
  if (!proof.ok) return proof.response;
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
  const optionB = createOptionBConfig();
  const updated: FilmLessonRecord | null = optionB.projectionStoreBackend === "upstash"
    ? await (async () => {
        const existing = await getLessonRecordFromProjection(body.id);
        if (!existing) return null;
        return {
          ...existing,
          ...patch,
        };
      })()
    : await getContentRepository().updateLessonRecord(body.id, patch);
  if (!updated) return jsonError("NOT_FOUND", "Lesson not found", 404);
  const updatedAt = new Date().toISOString();
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "lesson_updated",
      aggregateType: "lesson",
      aggregateId: updated.id,
      actor: { userId: gate.auth.userId, role: gate.auth.role },
      idempotencyKey: buildEventIdempotencyKey("admin-lesson-update", updated.id, updatedAt),
      payload: {
        lessonId: updated.id,
        courseId: updated.courseId,
        title: updated.title,
        synopsis: updated.synopsis,
        durationMin: updated.durationMin,
        maturityRating: updated.maturityRating,
        manifestBlobKey: updated.manifestBlobKey,
        streamAssetId: updated.streamAssetId,
        processingStatus: updated.processingStatus,
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
  const gate = await ensureAdmin(req);
  if (!gate.ok) return gate.response;
  const proof = await requireWalletActionProof(req, gate.auth.userId);
  if (!proof.ok) return proof.response;
  const body = (await req.json().catch(() => null)) as LessonDeleteRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Lesson id is required", 422);
  }
  const optionB = createOptionBConfig();
  if (optionB.projectionStoreBackend !== "upstash") {
    const deleted = await getContentRepository().deleteLessonRecord(body.id);
    if (!deleted) return jsonError("NOT_FOUND", "Lesson not found", 404);
  }
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "lesson_deleted",
      aggregateType: "lesson",
      aggregateId: body.id,
      actor: { userId: gate.auth.userId, role: gate.auth.role },
      idempotencyKey: buildEventIdempotencyKey("admin-lesson-delete", body.id),
      payload: { lessonId: body.id },
    }),
  );
  await runProjectionBatch(200);
  return jsonOk({ deleted: true });
}
