import { getAuthContextFromRequest } from "@/lib/server/auth";
import type { FilmCategory } from "@/lib/contracts/admin";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { getCategoryFromProjection, listCategoriesFromProjection } from "@/lib/projections/category-read-model";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getContentRepository, getEventStore } from "@/lib/repositories";

type CategoryCreateRequest = {
  name: string;
  description?: string;
};

type CategoryPatchRequest = {
  id: string;
  name?: string;
  description?: string;
};

type CategoryDeleteRequest = {
  id: string;
};

function isValid(body: unknown): body is CategoryCreateRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.name === "string";
}

function ensureAdmin(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return { ok: false as const, response: jsonError("UNAUTHORIZED", "Session is required", 401) };
  if (auth.role !== "admin") return { ok: false as const, response: jsonError("FORBIDDEN", "Admin access required", 403) };
  return { ok: true as const, auth };
}

export async function GET(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const optionB = createOptionBConfig();
  return jsonOk(
    optionB.projectionStoreBackend === "upstash"
      ? await listCategoriesFromProjection()
      : await getContentRepository().listCategories(),
  );
}

export async function POST(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body)) return jsonError("INVALID_REQUEST", "Category name is required", 422);
  const optionB = createOptionBConfig();
  const created: FilmCategory = optionB.projectionStoreBackend === "upstash"
    ? {
        id: `cat_${crypto.randomUUID().slice(0, 12)}`,
        name: body.name,
        description: body.description,
        createdAt: new Date().toISOString(),
      }
    : await getContentRepository().addCategory({ name: body.name, description: body.description });
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "category_created",
      aggregateType: "category",
      aggregateId: created.id,
      actor: {
        userId: gate.auth.userId,
        role: gate.auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("category-create", created.id),
      payload: created,
    }),
  );
  await runProjectionBatch(200);
  return jsonOk(created, 201);
}

export async function PATCH(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as CategoryPatchRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Category id is required", 422);
  }
  if (typeof body.name !== "string" && typeof body.description !== "string") {
    return jsonError("INVALID_REQUEST", "At least one field must be updated", 422);
  }

  const optionB = createOptionBConfig();
  const existing = optionB.projectionStoreBackend === "upstash"
    ? await getCategoryFromProjection(body.id)
    : null;
  const updated: FilmCategory | null = optionB.projectionStoreBackend === "upstash"
    ? existing
      ? {
          ...existing,
          ...(typeof body.name === "string" ? { name: body.name } : {}),
          ...(typeof body.description === "string" ? { description: body.description } : {}),
        }
      : null
    : await getContentRepository().updateCategory(body.id, {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
      });
  if (!updated) return jsonError("NOT_FOUND", "Category not found", 404);
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "category_updated",
      aggregateType: "category",
      aggregateId: updated.id,
      actor: {
        userId: gate.auth.userId,
        role: gate.auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("category-update", updated.id, updated.name),
      payload: updated,
    }),
  );
  await runProjectionBatch(200);
  return jsonOk(updated);
}

export async function DELETE(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as CategoryDeleteRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Category id is required", 422);
  }

  const optionB = createOptionBConfig();
  const result = optionB.projectionStoreBackend === "upstash"
    ? { ok: Boolean(await getCategoryFromProjection(body.id)) }
    : await getContentRepository().deleteCategory(body.id);
  if (!result.ok) {
    if (result.reason === "Category not found") {
      return jsonError("NOT_FOUND", result.reason, 404);
    }
    return jsonError("CONFLICT", result.reason || "Unable to delete category", 409);
  }
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "category_deleted",
      aggregateType: "category",
      aggregateId: body.id,
      actor: {
        userId: gate.auth.userId,
        role: gate.auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("category-delete", body.id),
      payload: {
        id: body.id,
      },
    }),
  );
  await runProjectionBatch(200);
  return jsonOk({ deleted: true });
}
