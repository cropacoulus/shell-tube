import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getProfileFromProjection } from "@/lib/projections/profile-read-model";
import { getEventStore, getProfileRepository } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { ServiceError } from "@/lib/services/http-client";
import { getInternalBlobReadPath, putShelbyBlob } from "@/lib/services/shelby-storage-client";
import { requireWalletActionProof } from "@/lib/server/wallet-action-auth";

function extensionFromType(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/jpeg") return "jpg";
  return "bin";
}

function mapAvatarUploadError(error: ServiceError, userId: string) {
  const normalized = error.message.toLowerCase();
  if (normalized.includes("has not been registered onto the l1")) {
    return jsonError(
      "INVALID_REQUEST",
      `Avatar upload requires an L1 blob registration first. Register \`profiles/avatar\` for wallet ${userId.slice(0, 8)}... before uploading.`,
      422,
    );
  }
  return jsonError("UPSTREAM_ERROR", error.message, error.status);
}

export async function POST(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const proof = await requireWalletActionProof(req, auth.userId);
  if (!proof.ok) return proof.response;
  const optionB = createOptionBConfig();
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return jsonError("INVALID_REQUEST", "Missing file in form-data", 422);
  }

  if (!file.type.startsWith("image/")) {
    return jsonError("INVALID_REQUEST", "Avatar must be an image file", 422);
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const ext = extensionFromType(file.type);
    const blobName = `profiles/avatar.${ext}`;
    const uploaded = await putShelbyBlob({
      accountAddress: auth.userId,
      blobName,
      contentType: file.type,
      data: new Uint8Array(arrayBuffer),
    });

    const existing = optionB.projectionStoreBackend === "upstash"
      ? await getProfileFromProjection(auth.userId)
      : await getProfileRepository().getProfile(auth.userId);
    const updatedProfile = {
      userId: auth.userId,
      displayName: existing?.displayName ?? `${auth.userId.slice(0, 6)}...${auth.userId.slice(-4)}`,
      avatarUrl: getInternalBlobReadPath(uploaded.blobKey),
      role: effectiveRole,
      updatedAt: new Date().toISOString(),
    };
    if (optionB.projectionStoreBackend !== "upstash") {
      await getProfileRepository().upsertProfile(updatedProfile);
    }
    await getEventStore().appendEvent(
      createDomainEvent({
        type: "profile_updated",
        aggregateType: "profile",
        aggregateId: updatedProfile.userId,
        actor: {
          userId: auth.userId,
          role: auth.role,
        },
        idempotencyKey: buildEventIdempotencyKey("profile-avatar-update", updatedProfile.userId, updatedProfile.updatedAt),
        payload: updatedProfile,
      }),
    );
    await runProjectionBatch(200);

    return jsonOk(updatedProfile);
  } catch (error) {
    if (error instanceof ServiceError) {
      return mapAvatarUploadError(error, auth.userId);
    }
    return jsonError("INTERNAL_ERROR", "Unable to upload avatar", 500);
  }
}
