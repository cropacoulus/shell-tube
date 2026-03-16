import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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

  return (
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8 md:px-10">
        <Link href="/creator/courses" className="inline-block text-sm text-white/70 hover:text-white">
          Back to creator courses
        </Link>
        <section className="rounded-2xl border border-white/10 bg-[#10141f] p-5">
          <p className="text-xs uppercase tracking-wide text-[#ff594f]">{course.category}</p>
          <h1 className="mt-1 text-3xl font-semibold">{course.title}</h1>
          <p className="mt-2 text-sm text-white/75">{course.description}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/60">Total Lessons</p>
              <p className="mt-1 text-2xl font-semibold">{lessons.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/60">Unlocked (Current User)</p>
              <p className="mt-1 text-2xl font-semibold">{unlockedCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/60">Course Year</p>
              <p className="mt-1 text-2xl font-semibold">{course.year}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/60">Total Views</p>
              <p className="mt-1 text-2xl font-semibold">{analytics.totalViews}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/60">Watch Time</p>
              <p className="mt-1 text-2xl font-semibold">{analytics.totalWatchTimeMin} min</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/60">Average Completion</p>
              <p className="mt-1 text-2xl font-semibold">{analytics.averageCompletionRate}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/60">Projected Course Revenue</p>
              <p className="mt-1 text-2xl font-semibold">${revenue.projectedCourseRevenueUsd.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/60">Projected Subscription Share</p>
              <p className="mt-1 text-2xl font-semibold">${revenue.projectedSubscriptionShareUsd.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/60">Projected Payout Total</p>
              <p className="mt-1 text-2xl font-semibold">${revenue.totalProjectedRevenueUsd.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/60">Settled Payout Total</p>
              <p className="mt-1 text-2xl font-semibold">${revenue.totalSettledRevenueUsd.toFixed(2)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#10141f] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Revenue Ledger</h2>
              <p className="mt-1 text-xs text-white/50">Audit-friendly placeholder until payments and subscriptions are implemented end-to-end.</p>
            </div>
          </div>
          <div className="space-y-2">
            {revenue.payoutLedger.length > 0 ? revenue.payoutLedger.map((entry) => (
              <div key={entry.id} className="grid gap-3 rounded-lg border border-white/10 px-3 py-3 md:grid-cols-[0.9fr_0.6fr_1.6fr]">
                <div>
                  <p className="text-xs text-white/55">{entry.sourceType} · {entry.status}</p>
                  <p className="mt-1 text-sm font-semibold">${entry.amountUsd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Period</p>
                  <p className="mt-1 text-sm font-semibold">{entry.periodKey}</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Formula Snapshot</p>
                  <p className="mt-1 break-all font-mono text-[11px] leading-5 text-white/70">{entry.formulaSnapshot}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-white/10 px-3 py-5 text-sm text-white/55">
                No payout projection for this course yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#10141f] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Lessons</h2>
            <Link href="/creator/uploads" className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black">
              Open Creator Editor
            </Link>
          </div>
          <div className="space-y-2">
            {lessons.map((lesson, index) => (
              <div key={lesson.id} className="grid gap-3 rounded-lg border border-white/10 px-3 py-3 md:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]">
                <div>
                  <p className="text-xs text-white/60">Lesson {index + 1}</p>
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
                <div className="flex items-center justify-between gap-3 md:justify-end">
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
