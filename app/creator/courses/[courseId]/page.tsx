import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SectionSubnav } from "@/app/_components/section-subnav";
import StickyNavbar from "@/app/_components/sticky-navbar";
import { canPublishContent } from "@/lib/auth/capabilities";
import { getCreatorCourseAnalyticsSnapshot } from "@/lib/server/creator-analytics-flow";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { canAccessCreatorCourse } from "@/lib/server/creator-content-flow";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { getCreatorCourseRevenueSnapshot, syncCreatorRevenueLedger } from "@/lib/server/creator-revenue-flow";
import { getCourseById, listLessonsByCourse } from "@/lib/server/course-flow";
import { checkEntitlement } from "@/lib/services/entitlement-client";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CreatorCourseDetailPage({ params }: PageProps) {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canPublishContent(effectiveRole)) redirect("/");

  const { courseId } = await params;
  const canAccess = await canAccessCreatorCourse({
    courseId,
    profileId: auth.profileId,
    role: effectiveRole,
  });
  if (!canAccess) redirect("/creator/courses");
  const [course, lessons, analytics] = await Promise.all([
    getCourseById(courseId),
    listLessonsByCourse(courseId),
    getCreatorCourseAnalyticsSnapshot({
      courseId,
      role: effectiveRole,
      profileId: auth.profileId,
    }),
  ]);
  await syncCreatorRevenueLedger({
    role: effectiveRole,
    profileId: auth.profileId,
  });
  const revenue = await getCreatorCourseRevenueSnapshot({
      courseId,
      role: effectiveRole,
      profileId: auth.profileId,
    });
  if (!course) notFound();

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

  const unlockedCount = entitlementSummary.filter((item) => item.allowed).length;
  const publishedLessons = analytics.lessons.filter((lesson) => lesson.publishStatus === "published").length;

  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8 md:px-10 md:py-12">
        <Link href="/creator/courses" className="inline-block text-sm text-white/70 hover:text-white">
          Back to creator library
        </Link>
        <SectionSubnav
          items={[
            { href: "/creator/uploads", label: "Studio" },
            { href: "/creator/courses", label: "My Courses" },
            { href: "/creator/analytics", label: "Analytics" },
          ]}
        />
        <section className="app-panel rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="status-pill">{course.category}</span>
            <span className="status-pill">{publishedLessons} published lesson{publishedLessons === 1 ? "" : "s"}</span>
            <span className="status-pill">{course.year}</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold md:text-5xl">{course.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72 md:text-base">{course.description}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Total lessons</p>
              <p className="mt-1 text-2xl font-semibold">{lessons.length}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Available to current wallet</p>
              <p className="mt-1 text-2xl font-semibold">{unlockedCount}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Published lessons</p>
              <p className="mt-1 text-2xl font-semibold">{publishedLessons}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Total views</p>
              <p className="mt-1 text-2xl font-semibold">{analytics.totalViews}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Watch time</p>
              <p className="mt-1 text-2xl font-semibold">{analytics.totalWatchTimeMin} min</p>
            </div>
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Average completion</p>
              <p className="mt-1 text-2xl font-semibold">{analytics.averageCompletionRate}%</p>
            </div>
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Projected course revenue</p>
              <p className="mt-1 text-2xl font-semibold">${revenue.projectedCourseRevenueUsd.toFixed(2)}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Projected subscription share</p>
              <p className="mt-1 text-2xl font-semibold">${revenue.projectedSubscriptionShareUsd.toFixed(2)}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Projected payout total</p>
              <p className="mt-1 text-2xl font-semibold">${revenue.totalProjectedRevenueUsd.toFixed(2)}</p>
            </div>
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Settled payout total</p>
              <p className="mt-1 text-2xl font-semibold">${revenue.totalSettledRevenueUsd.toFixed(2)}</p>
            </div>
          </div>
        </section>

        <section className="app-panel rounded-[2rem] p-6">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="app-kicker">Revenue view</p>
              <h2 className="mt-2 text-2xl font-semibold">Revenue ledger</h2>
              <p className="mt-2 text-sm text-white/60">Operational payout signals for this course. The raw formula payload is intentionally hidden from the main creator view.</p>
            </div>
          </div>
          <div className="space-y-2">
            {revenue.payoutLedger.length > 0 ? revenue.payoutLedger.map((entry) => (
              <div key={entry.id} className="grid gap-3 rounded-[1.35rem] border border-white/10 bg-white/4 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_0.8fr_0.8fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">{entry.sourceType}</p>
                  <p className="mt-2 text-lg font-semibold">${entry.amountUsd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Period</p>
                  <p className="mt-1 text-sm font-semibold">{entry.periodKey}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Status</p>
                  <p className="mt-1 text-sm font-semibold capitalize">{entry.status}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-white/10 px-3 py-5 text-sm text-white/55">
                No payout projection for this course yet.
              </div>
            )}
          </div>
        </section>

        <section className="app-panel rounded-[2rem] p-6">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="app-kicker">Release breakdown</p>
              <h2 className="mt-2 text-2xl font-semibold">Lessons</h2>
            </div>
            <Link href="/creator/uploads" className="app-primary-button w-full px-4 py-2.5 text-sm sm:w-auto">
              Open studio
            </Link>
          </div>
          <div className="space-y-2">
            {lessons.map((lesson, index) => (
              <div key={lesson.id} className="grid gap-3 rounded-[1.35rem] border border-white/10 bg-white/4 p-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]">
                <div className="sm:col-span-2 xl:col-span-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Lesson {index + 1}</p>
                  <p className="font-medium">{lesson.title}</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Duration</p>
                  <p className="mt-1 text-sm font-semibold">{lesson.durationMin} min</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Views</p>
                  <p className="mt-1 text-sm font-semibold">
                    {analytics.lessons.find((item) => item.lessonId === lesson.id)?.views ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Watch Time</p>
                  <p className="mt-1 text-sm font-semibold">
                    {analytics.lessons.find((item) => item.lessonId === lesson.id)?.watchTimeMin ?? 0} min
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:col-span-2 xl:col-span-1 xl:justify-end">
                  <div>
                    <p className="text-xs text-white/55">Completion</p>
                    <p className="mt-1 text-sm font-semibold">
                      {analytics.lessons.find((item) => item.lessonId === lesson.id)?.completionRate ?? 0}%
                    </p>
                  </div>
                  <Link href={`/lesson/${lesson.id}`} className="rounded-md border border-white/30 px-2 py-1 text-xs hover:bg-white/10">
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
