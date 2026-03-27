import { canPublishContent } from "@/lib/auth/capabilities";
import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { listCreatorOwnedCourseSummaries } from "@/lib/server/creator-content-flow";
import { getEffectiveUserRole } from "@/lib/server/effective-role";

export async function GET(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Wallet session is required", 401);

  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canPublishContent(effectiveRole)) {
    return jsonError("FORBIDDEN", "Creator access is required", 403);
  }

  const courses = await listCreatorOwnedCourseSummaries({
    profileId: auth.profileId,
    role: effectiveRole,
  });

  return jsonOk({
    effectiveRole,
    courses,
  });
}
