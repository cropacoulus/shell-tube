import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getProfileRepository } from "@/lib/repositories";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { ServiceError } from "@/lib/services/http-client";
import { putShelbyBlob } from "@/lib/services/shelby-storage-client";

function extensionFromType(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/jpeg") return "jpg";
  return "bin";
}

export async function POST(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const profileRepository = getProfileRepository();
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

    const existing = await profileRepository.getProfile(auth.userId);
    const updatedProfile = await profileRepository.upsertProfile({
      userId: auth.userId,
      displayName: existing?.displayName ?? `${auth.userId.slice(0, 6)}...${auth.userId.slice(-4)}`,
      avatarUrl: uploaded.readUrl,
      role: existing?.role ?? effectiveRole,
      updatedAt: new Date().toISOString(),
    });

    return jsonOk(updatedProfile);
  } catch (error) {
    if (error instanceof ServiceError) {
      return jsonError("UPSTREAM_ERROR", error.message, error.status);
    }
    return jsonError("INTERNAL_ERROR", "Unable to upload avatar", 500);
  }
}
