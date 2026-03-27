import { getCreatorApplicationStatus } from "@/lib/blockchain/role-registry";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import {
  buildOnChainCreatorApplicationRecord,
  getLatestCreatorApplicationForUserFromProjection,
  listCreatorApplicationsForUserFromProjection,
} from "@/lib/projections/creator-application-read-model";
import { getProfileFromProjection } from "@/lib/projections/profile-read-model";
import { getCreatorApplicationRepository, getEventStore, getProfileRepository } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { requireWalletActionProof } from "@/lib/server/wallet-action-auth";

type CreatorApplicationCreateRequest = {
  pitch: string;
  onChainTxHash?: string;
};

function isValid(body: unknown): body is CreatorApplicationCreateRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.pitch === "string";
}

export async function GET(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);

  const optionB = createOptionBConfig();
  if (optionB.projectionStoreBackend === "upstash") {
    const applications = await listCreatorApplicationsForUserFromProjection(auth.userId);
    if (applications.length > 0) return jsonOk(applications);

    const [onChainStatus, profile] = await Promise.all([
      getCreatorApplicationStatus(auth.userId),
      getProfileFromProjection(auth.userId),
    ]);
    const onChainRecord = buildOnChainCreatorApplicationRecord({
      userId: auth.userId,
      displayName: profile?.displayName,
      status: onChainStatus,
    });
    return jsonOk(onChainRecord ? [onChainRecord] : []);
  }

  const applications = await getCreatorApplicationRepository().listCreatorApplicationsByUser(auth.userId);
  return jsonOk(applications);
}

export async function POST(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const proof = await requireWalletActionProof(req, auth.userId);
  if (!proof.ok) return proof.response;

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body) || !body.pitch.trim()) {
    return jsonError("INVALID_REQUEST", "pitch is required", 422);
  }

  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (effectiveRole === "creator" || effectiveRole === "admin") {
    return jsonError("INVALID_REQUEST", "Your account already has creator access", 409);
  }

  const optionB = createOptionBConfig();
  const repository = getCreatorApplicationRepository();
  const latest = optionB.projectionStoreBackend === "upstash"
    ? await getLatestCreatorApplicationForUserFromProjection(auth.userId)
    : (await repository.listCreatorApplicationsByUser(auth.userId))[0];
  if (latest && (latest.status === "pending" || latest.status === "approved")) {
    return jsonError(
      "INVALID_REQUEST",
      latest.status === "pending"
        ? "Your creator application is still pending review"
        : "Your creator application is already approved",
      409,
    );
  }

  const onChainStatus = await getCreatorApplicationStatus(auth.userId);
  if (onChainStatus !== "pending") {
    return jsonError(
      "INVALID_REQUEST",
      onChainStatus === "approved"
        ? "Creator access is already approved on-chain"
        : onChainStatus === "rejected"
          ? "Your last on-chain creator application was rejected. Submit a new on-chain request first."
          : "Submit the creator application on-chain first from your wallet.",
      409,
    );
  }

  const profile = optionB.projectionStoreBackend === "upstash"
    ? await getProfileFromProjection(auth.userId)
    : await getProfileRepository().getProfile(auth.userId);
  const created = await repository.createCreatorApplication({
    userId: auth.userId,
    displayName: profile?.displayName ?? `${auth.userId.slice(0, 6)}...${auth.userId.slice(-4)}`,
    pitch: body.pitch.trim(),
  });

  await getEventStore().appendEvent(
    createDomainEvent({
      type: "creator_application_submitted",
      aggregateType: "creator_application",
      aggregateId: created.id,
      actor: {
        userId: auth.userId,
        role: auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("creator-application-submit", auth.userId, created.id),
      payload: {
        applicationId: created.id,
        userId: created.userId,
        displayName: created.displayName,
        pitch: created.pitch,
        status: created.status,
        onChainTxHash: body.onChainTxHash,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    }),
  );

  await runProjectionBatch(200);

  return jsonOk(created, 201);
}
