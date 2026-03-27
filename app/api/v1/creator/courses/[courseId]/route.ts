import { canPublishContent } from "@/lib/auth/capabilities";
import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getCreatorCourseAnalyticsSnapshot } from "@/lib/server/creator-analytics-flow";
import { canAccessCreatorCourse } from "@/lib/server/creator-content-flow";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { getCreatorCourseRevenueSnapshot, syncCreatorRevenueLedger } from "@/lib/server/creator-revenue-flow";
import { getCourseById, listLessonsByCourse } from "@/lib/server/course-flow";
import { checkEntitlement } from "@/lib/services/entitlement-client";

type RouteProps = {
  params: Promise<{ courseId: string }>;
};

export async function GET(req: Request, { params }: RouteProps) {
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Wallet session is required", 401);

  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canPublishContent(effectiveRole)) {
    return jsonError("FORBIDDEN", "Creator access is required", 403);
  }

  const { courseId } = await params;
  const canAccess = await canAccessCreatorCourse({
    courseId,
    profileId: auth.profileId,
    role: effectiveRole,
  });
  if (!canAccess) {
    return jsonError("FORBIDDEN", "This wallet cannot access the requested course", 403);
  }

  const [course, lessons, analytics] = await Promise.all([
    getCourseById(courseId),
    listLessonsByCourse(courseId),
    getCreatorCourseAnalyticsSnapshot({
      courseId,
      role: effectiveRole,
      profileId: auth.profileId,
    }),
  ]);
  if (!course) return jsonError("NOT_FOUND", "Course not found", 404);

  await syncCreatorRevenueLedger({
    role: effectiveRole,
    profileId: auth.profileId,
  });
  const revenue = await getCreatorCourseRevenueSnapshot({
    courseId,
    role: effectiveRole,
    profileId: auth.profileId,
  });

  const entitlementSummary = await Promise.all(
    lessons.map(async (lesson) => {
      const result = await checkEntitlement({
        userId: auth.userId,
        profileId: auth.profileId,
        titleId: lesson.id,
        region: auth.region,
      }).catch(() => ({ allowed: false }));
      return { lessonId: lesson.id, allowed: result.allowed };
    }),
  );

  return jsonOk({
    effectiveRole,
    course,
    lessons,
    analytics,
    revenue,
    unlockedCount: entitlementSummary.filter((item) => item.allowed).length,
    publishedLessons: analytics.lessons.filter((lesson) => lesson.publishStatus === "published").length,
  });
}
