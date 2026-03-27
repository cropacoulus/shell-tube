import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { listCourseSummaries } from "@/lib/server/course-flow";
import { getDashboardSnapshot } from "@/lib/server/dashboard-flow";

export async function GET(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Wallet session is required", 401);

  const [courses, dashboard] = await Promise.all([
    listCourseSummaries(),
    getDashboardSnapshot(auth.userId),
  ]);

  return jsonOk({
    coursesCount: courses.length,
    dashboard,
  });
}
