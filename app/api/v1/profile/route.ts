import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getProfileFromProjection } from "@/lib/projections/profile-read-model";
import { getProfileRepository } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { getEventStore } from "@/lib/repositories";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { requireWalletActionProof } from "@/lib/server/wallet-action-auth";

type ProfileUpdateRequest = {
  displayName?: string;
  avatarUrl?: string;
};

export async function GET(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const optionB = createOptionBConfig();
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });

  const existing = optionB.projectionStoreBackend === "upstash"
    ? await getProfileFromProjection(auth.userId)
    : await getProfileRepository().getProfile(auth.userId);
  if (!existing) {
    const created = {
      userId: auth.userId,
      displayName: `${auth.userId.slice(0, 6)}...${auth.userId.slice(-4)}`,
      role: effectiveRole,
      updatedAt: new Date().toISOString(),
    };
    if (optionB.projectionStoreBackend !== "upstash") {
      await getProfileRepository().upsertProfile(created);
    }
    await getEventStore().appendEvent(
      createDomainEvent({
        type: "profile_updated",
        aggregateType: "profile",
        aggregateId: created.userId,
        actor: {
          userId: auth.userId,
          role: auth.role,
        },
        idempotencyKey: buildEventIdempotencyKey("profile-bootstrap", created.userId, created.updatedAt),
        payload: created,
      }),
    );
    await runProjectionBatch(200);
    return jsonOk(created);
  }
  return jsonOk({
    ...existing,
    role: effectiveRole,
  });
}

export async function PUT(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const proof = await requireWalletActionProof(req, auth.userId);
  if (!proof.ok) return proof.response;
  const optionB = createOptionBConfig();
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });

  const body = (await req.json().catch(() => null)) as ProfileUpdateRequest | null;
  if (!body || (typeof body.displayName !== "string" && typeof body.avatarUrl !== "string")) {
    return jsonError("INVALID_REQUEST", "Provide displayName and/or avatarUrl", 422);
  }

  const existing = optionB.projectionStoreBackend === "upstash"
    ? await getProfileFromProjection(auth.userId)
    : await getProfileRepository().getProfile(auth.userId);
  const updated = {
    userId: auth.userId,
    displayName: body.displayName ?? existing?.displayName ?? auth.userId,
    avatarUrl: body.avatarUrl ?? existing?.avatarUrl,
    role: effectiveRole,
    updatedAt: new Date().toISOString(),
  };
  if (optionB.projectionStoreBackend !== "upstash") {
    await getProfileRepository().upsertProfile(updated);
  }
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "profile_updated",
      aggregateType: "profile",
      aggregateId: updated.userId,
      actor: {
        userId: auth.userId,
        role: auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("profile-update", updated.userId, updated.updatedAt),
      payload: updated,
    }),
  );
  await runProjectionBatch(200);
  return jsonOk(updated);
}
