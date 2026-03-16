import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getProfileRepository } from "@/lib/repositories";
import { getEffectiveUserRole } from "@/lib/server/effective-role";

type ProfileUpdateRequest = {
  displayName?: string;
  avatarUrl?: string;
};

export async function GET(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const profileRepository = getProfileRepository();
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });

  const existing = await profileRepository.getProfile(auth.userId);
  if (!existing) {
    const created = await profileRepository.upsertProfile({
      userId: auth.userId,
      displayName: `${auth.userId.slice(0, 6)}...${auth.userId.slice(-4)}`,
      role: effectiveRole,
      updatedAt: new Date().toISOString(),
    });
    return jsonOk(created);
  }
  return jsonOk(existing);
}

export async function PUT(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const profileRepository = getProfileRepository();
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });

  const body = (await req.json().catch(() => null)) as ProfileUpdateRequest | null;
  if (!body || (typeof body.displayName !== "string" && typeof body.avatarUrl !== "string")) {
    return jsonError("INVALID_REQUEST", "Provide displayName and/or avatarUrl", 422);
  }

  const existing = await profileRepository.getProfile(auth.userId);
  const updated = await profileRepository.upsertProfile({
    userId: auth.userId,
    displayName: body.displayName ?? existing?.displayName ?? auth.userId,
    avatarUrl: body.avatarUrl ?? existing?.avatarUrl,
    role: existing?.role ?? effectiveRole,
    updatedAt: new Date().toISOString(),
  });
  return jsonOk(updated);
}
