import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { listCourseSummaries } from "@/lib/server/course-flow";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { listCourseSummariesFromProjection } from "@/lib/projections/catalog-read-model";

export async function GET(req: Request) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const optionB = createOptionBConfig();
  if (optionB.projectionStoreBackend === "upstash") {
    const courses = await listCourseSummariesFromProjection();
    return jsonOk({ courses });
  }
  const courses = await listCourseSummaries();
  return jsonOk({ courses });
}
