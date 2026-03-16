import { canModeratePlatform } from "@/lib/auth/capabilities";
import {
  getCreatorApplicationRepository,
  getProfileRepository,
} from "@/lib/repositories";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";

type CreatorApplicationPatchRequest = {
  id: string;
  status: "approved" | "rejected";
};

function ensureAdmin(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return { ok: false as const, response: jsonError("UNAUTHORIZED", "Session is required", 401) };
  if (!canModeratePlatform(auth.role)) {
    return { ok: false as const, response: jsonError("FORBIDDEN", "Admin access required", 403) };
  }
  return { ok: true as const, auth };
}

function isValidPatch(body: unknown): body is CreatorApplicationPatchRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.id === "string" && (candidate.status === "approved" || candidate.status === "rejected");
}

export async function GET(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const [items, creators] = await Promise.all([
    getCreatorApplicationRepository().listCreatorApplications(),
    getProfileRepository().listProfilesByRole("creator"),
  ]);
  return jsonOk({
    pendingApplications: items.filter((item) => item.status === "pending"),
    creators,
  });
}

export async function PATCH(req: Request) {
  const gate = ensureAdmin(req);
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValidPatch(body)) {
    return jsonError("INVALID_REQUEST", "id and status are required", 422);
  }

  const existing = (await getCreatorApplicationRepository().listCreatorApplications()).find((item) => item.id === body.id);
  if (!existing) {
    return jsonError("NOT_FOUND", "Creator application not found", 404);
  }
  if (existing.status !== "pending") {
    return jsonError("CONFLICT", "Creator application has already been reviewed", 409);
  }

  const application = await getCreatorApplicationRepository().updateCreatorApplicationStatus(body.id, {
    status: body.status,
    reviewedByUserId: gate.auth.userId,
  });
  if (!application) return jsonError("NOT_FOUND", "Creator application not found", 404);

  if (body.status === "approved") {
    const profileRepository = getProfileRepository();
    const existing = await profileRepository.getProfile(application.userId);
    await profileRepository.upsertProfile({
      userId: application.userId,
      displayName: existing?.displayName ?? application.displayName,
      avatarUrl: existing?.avatarUrl,
      role: "creator",
      updatedAt: new Date().toISOString(),
    });
  }

  return jsonOk(application);
}
