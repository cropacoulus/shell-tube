import { canModeratePlatform } from "@/lib/auth/capabilities";
import type { DomainEvent } from "@/lib/events/contracts";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import {
  getCreatorApplicationByIdFromProjection,
  getCreatorApplicationProjectionSnapshot,
} from "@/lib/projections/creator-application-read-model";
import {
  getCreatorApplicationRepository,
  getEventStore,
  getProfileRepository,
} from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
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

  const optionB = createOptionBConfig();
  if (optionB.projectionStoreBackend === "upstash") {
    const snapshot = await getCreatorApplicationProjectionSnapshot();
    return jsonOk(snapshot);
  }

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

  const optionB = createOptionBConfig();
  const existing = optionB.projectionStoreBackend === "upstash"
    ? await getCreatorApplicationByIdFromProjection(body.id)
    : (await getCreatorApplicationRepository().listCreatorApplications()).find((item) => item.id === body.id);
  if (!existing) {
    return jsonError("NOT_FOUND", "Creator application not found", 404);
  }
  if (existing.status !== "pending") {
    return jsonError("CONFLICT", "Creator application has already been reviewed", 409);
  }

  const reviewedAt = new Date().toISOString();
  const application = optionB.projectionStoreBackend === "upstash"
    ? {
        id: existing.id,
        userId: existing.userId,
        displayName: existing.displayName,
        pitch: existing.pitch,
        status: body.status,
        createdAt: existing.createdAt,
        updatedAt: reviewedAt,
        reviewedByUserId: gate.auth.userId,
        reviewedAt,
      }
    : await getCreatorApplicationRepository().updateCreatorApplicationStatus(body.id, {
        status: body.status,
        reviewedByUserId: gate.auth.userId,
      });
  if (!application) return jsonError("NOT_FOUND", "Creator application not found", 404);

  const events: DomainEvent[] = [
    createDomainEvent({
      type: body.status === "approved" ? "creator_application_approved" : "creator_application_rejected",
      aggregateType: "creator_application",
      aggregateId: application.id,
      actor: {
        userId: gate.auth.userId,
        role: gate.auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("creator-application-review", application.id, body.status),
      payload: {
        applicationId: application.id,
        userId: application.userId,
        status: application.status,
        reviewedByUserId: application.reviewedByUserId,
        reviewedAt: application.reviewedAt,
        updatedAt: application.updatedAt,
      },
    }),
  ];

  if (body.status === "approved") {
    const profileRepository = getProfileRepository();
    const updatedProfile = optionB.projectionStoreBackend === "upstash"
      ? {
          userId: application.userId,
          displayName: application.displayName,
          avatarUrl: undefined,
          role: "creator" as const,
          updatedAt: new Date().toISOString(),
        }
      : await (async () => {
          const existingProfile = await profileRepository.getProfile(application.userId);
          return profileRepository.upsertProfile({
            userId: application.userId,
            displayName: existingProfile?.displayName ?? application.displayName,
            avatarUrl: existingProfile?.avatarUrl,
            role: "creator",
            updatedAt: new Date().toISOString(),
          });
        })();

    events.push(
      createDomainEvent({
        type: "profile_updated",
        aggregateType: "profile",
        aggregateId: updatedProfile.userId,
        actor: {
          userId: gate.auth.userId,
          role: gate.auth.role,
        },
        idempotencyKey: buildEventIdempotencyKey("profile-role-upgrade", updatedProfile.userId, updatedProfile.role),
        payload: {
          userId: updatedProfile.userId,
          displayName: updatedProfile.displayName,
          avatarUrl: updatedProfile.avatarUrl,
          role: updatedProfile.role,
          updatedAt: updatedProfile.updatedAt,
        },
      }),
    );
  }

  await getEventStore().appendEvents(events);
  await runProjectionBatch(200);

  return jsonOk(application);
}
