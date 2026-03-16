import { getCreatorApplicationRepository, getProfileRepository } from "@/lib/repositories";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getEffectiveUserRole } from "@/lib/server/effective-role";

type CreatorApplicationCreateRequest = {
  pitch: string;
};

function isValid(body: unknown): body is CreatorApplicationCreateRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.pitch === "string";
}

export async function GET(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);

  const applications = await getCreatorApplicationRepository().listCreatorApplicationsByUser(auth.userId);
  return jsonOk(applications);
}

export async function POST(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);

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

  const repository = getCreatorApplicationRepository();
  const existing = await repository.listCreatorApplicationsByUser(auth.userId);
  const latest = existing[0];
  if (latest && (latest.status === "pending" || latest.status === "approved")) {
    return jsonError(
      "INVALID_REQUEST",
      latest.status === "pending"
        ? "Your creator application is still pending review"
        : "Your creator application is already approved",
      409,
    );
  }

  const profile = await getProfileRepository().getProfile(auth.userId);
  const created = await repository.createCreatorApplication({
    userId: auth.userId,
    displayName: profile?.displayName ?? `${auth.userId.slice(0, 6)}...${auth.userId.slice(-4)}`,
    pitch: body.pitch.trim(),
  });
  return jsonOk(created, 201);
}
