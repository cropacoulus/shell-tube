import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { canModeratePlatform, canViewCreatorAnalytics } from "@/lib/auth/capabilities";
import { getRevenueRepository } from "@/lib/repositories";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { syncCreatorRevenueLedger } from "@/lib/server/creator-revenue-flow";

export async function GET(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canViewCreatorAnalytics(effectiveRole)) {
    return jsonError("FORBIDDEN", "Creator or admin access required", 403);
  }

  const snapshot = await syncCreatorRevenueLedger({
    role: effectiveRole,
    profileId: auth.profileId,
  });

  return jsonOk(snapshot);
}

type PayoutStatusPatchRequest = {
  id: string;
  status: "projected" | "settled";
};

function isValidPatch(body: unknown): body is PayoutStatusPatchRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.id === "string" && (candidate.status === "projected" || candidate.status === "settled");
}

export async function PATCH(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  if (!canModeratePlatform(auth.role)) {
    return jsonError("FORBIDDEN", "Admin access required", 403);
  }

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValidPatch(body)) {
    return jsonError("INVALID_REQUEST", "id and status are required", 422);
  }

  const updated = await getRevenueRepository().updateCreatorPayoutLedgerStatus(body.id, body.status);
  if (!updated) {
    return jsonError("NOT_FOUND", "Payout ledger record not found", 404);
  }

  return jsonOk(updated);
}
