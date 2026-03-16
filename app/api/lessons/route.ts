import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { listLessonsByCourse } from "@/lib/server/course-flow";
import { ServiceError } from "@/lib/services/http-client";
import { checkEntitlement } from "@/lib/services/entitlement-client";

export async function GET(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return jsonError("INVALID_REQUEST", "courseId query parameter is required", 422);
  try {
    const lessons = await listLessonsByCourse(courseId);
    const lessonsWithEntitlement = await Promise.all(
      lessons.map(async (lesson) => {
        const entitlement = await checkEntitlement({
          userId: auth.userId,
          profileId: auth.profileId,
          titleId: lesson.id,
          region: auth.region,
        });
        return {
          ...lesson,
          entitlement: {
            allowed: entitlement.allowed,
            reason: entitlement.reason,
            plan: entitlement.plan,
          },
        };
      }),
    );
    return jsonOk({ lessons: lessonsWithEntitlement });
  } catch (error) {
    if (error instanceof ServiceError) {
      return jsonError("UPSTREAM_ERROR", error.message, error.status);
    }
    return jsonError("INTERNAL_ERROR", "Unable to load lessons", 500);
  }
}
