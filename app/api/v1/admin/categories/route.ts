import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getContentRepository } from "@/lib/repositories";

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
  return jsonOk(await getContentRepository().listCategories());
}

export async function POST(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body)) return jsonError("INVALID_REQUEST", "Category name is required", 422);
  const created = await getContentRepository().addCategory({ name: body.name, description: body.description });
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

  const updated = await getContentRepository().updateCategory(body.id, {
    ...(typeof body.name === "string" ? { name: body.name } : {}),
    ...(typeof body.description === "string" ? { description: body.description } : {}),
  });
  if (!updated) return jsonError("NOT_FOUND", "Category not found", 404);
  return jsonOk(updated);
}

export async function DELETE(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as CategoryDeleteRequest | null;
  if (!body || typeof body.id !== "string") {
    return jsonError("INVALID_REQUEST", "Category id is required", 422);
  }

  const result = await getContentRepository().deleteCategory(body.id);
  if (!result.ok) {
    if (result.reason === "Category not found") {
      return jsonError("NOT_FOUND", result.reason, 404);
    }
    return jsonError("CONFLICT", result.reason || "Unable to delete category", 409);
  }
  return jsonOk({ deleted: true });
}
