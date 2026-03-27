import { canViewCreatorAnalytics } from "@/lib/auth/capabilities";
import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getCreatorAnalyticsSnapshot } from "@/lib/server/creator-analytics-flow";
import { syncCreatorRevenueLedger } from "@/lib/server/creator-revenue-flow";
import { getEffectiveUserRole } from "@/lib/server/effective-role";

export async function GET(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Wallet session is required", 401);

  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canViewCreatorAnalytics(effectiveRole)) {
    return jsonError("FORBIDDEN", "Creator analytics access is required", 403);
  }

  const [analytics, revenue] = await Promise.all([
    getCreatorAnalyticsSnapshot({
      role: effectiveRole,
      profileId: auth.profileId,
    }),
    syncCreatorRevenueLedger({
      role: effectiveRole,
      profileId: auth.profileId,
    }),
  ]);

  return jsonOk({
    effectiveRole,
    analytics,
    revenue,
  });
}
