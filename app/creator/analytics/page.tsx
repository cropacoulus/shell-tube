import Link from "next/link";
import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import { canViewCreatorAnalytics } from "@/lib/auth/capabilities";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getCreatorAnalyticsSnapshot } from "@/lib/server/creator-analytics-flow";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { syncCreatorRevenueLedger } from "@/lib/server/creator-revenue-flow";

export default async function CreatorAnalyticsPage() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canViewCreatorAnalytics(effectiveRole)) redirect("/");

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

  return (
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8 md:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-[#ff594f]">Creator Analytics</p>
          <h1 className="text-3xl font-semibold">Analytics Overview</h1>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/creator/uploads" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">
              Create Course
            </Link>
            <Link href="/creator/courses" className="rounded-md border border-white/30 px-4 py-2 text-sm hover:bg-white/10">
              Open My Courses
            </Link>
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Published Courses</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.publishedCourseCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Published Lessons</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.publishedLessonCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Average Duration</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.averageDurationMin} min</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Total Views</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.totalViews}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Watch Time</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.totalWatchTimeMin} min</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Average Completion</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.averageCompletionRate}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Rebuffer Events</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.totalRebufferEvents}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Fatal Errors</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.totalFatalErrors}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Avg Peer Hit Ratio</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.averagePeerHitRatio}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Projected Course Revenue</p>
            <p className="mt-1 text-2xl font-semibold">${revenue.projectedCourseRevenueUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Projected Subscription Share</p>
            <p className="mt-1 text-2xl font-semibold">${revenue.projectedSubscriptionShareUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Projected Payout Total</p>
            <p className="mt-1 text-2xl font-semibold">${revenue.totalProjectedRevenueUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Settled Course Revenue</p>
            <p className="mt-1 text-2xl font-semibold">${revenue.settledCourseRevenueUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Settled Subscription Share</p>
            <p className="mt-1 text-2xl font-semibold">${revenue.settledSubscriptionShareUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Settled Payout Total</p>
            <p className="mt-1 text-2xl font-semibold">${revenue.totalSettledRevenueUsd.toFixed(2)}</p>
          </div>
        </div>
        <section className="space-y-3 rounded-2xl border border-white/10 bg-[#10141f] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Payout Ledger</h2>
              <p className="mt-1 text-xs text-white/50">Placeholder ledger until payment and subscription settlement go live.</p>
            </div>
          </div>
          <div className="space-y-2">
            {revenue.payoutLedger.length > 0 ? revenue.payoutLedger.map((entry) => (
              <div key={entry.id} className="grid gap-3 rounded-lg border border-white/10 px-3 py-3 md:grid-cols-[1.2fr_0.8fr_0.6fr_1.6fr]">
                <div>
                  <p className="font-medium">{entry.courseTitle ?? "Platform-wide"}</p>
                  <p className="mt-1 text-xs text-white/55">{entry.sourceType} · {entry.status}</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Period</p>
                  <p className="mt-1 text-sm font-semibold">{entry.periodKey}</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Amount</p>
                  <p className="mt-1 text-sm font-semibold">${entry.amountUsd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Formula Snapshot</p>
                  <p className="mt-1 break-all font-mono text-[11px] leading-5 text-white/70">{entry.formulaSnapshot}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-white/10 px-3 py-5 text-sm text-white/55">
                No projected payout entries yet. Revenue placeholders appear when published lessons accumulate watch time or completion activity.
              </div>
            )}
          </div>
        </section>
        <section className="space-y-3 rounded-2xl border border-white/10 bg-[#10141f] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Lesson Performance</h2>
            <p className="text-xs text-white/50">
              {effectiveRole === "admin" ? "Admin view across all creator content" : "Filtered to your owned courses"}
            </p>
          </div>
          <div className="space-y-2">
            {analytics.lessons.map((lesson) => (
              <div key={lesson.lessonId} className="grid gap-3 rounded-lg border border-white/10 px-3 py-3 md:grid-cols-[1.8fr_repeat(6,minmax(0,1fr))]">
                <div>
                  <p className="font-medium">{lesson.title}</p>
                  <p className="mt-1 text-xs text-white/55">{lesson.lessonId}</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Views</p>
                  <p className="mt-1 text-sm font-semibold">{lesson.views}</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Watch Time</p>
                  <p className="mt-1 text-sm font-semibold">{lesson.watchTimeMin} min</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Completion</p>
                  <p className="mt-1 text-sm font-semibold">{lesson.completionRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Rebuffers</p>
                  <p className="mt-1 text-sm font-semibold">{lesson.rebufferEvents}</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Peer Hit</p>
                  <p className="mt-1 text-sm font-semibold">{lesson.averagePeerHitRatio}%</p>
                </div>
                <div>
                  <p className="text-xs text-white/55">Status</p>
                  <p className="mt-1 text-sm font-semibold capitalize">{lesson.publishStatus}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
