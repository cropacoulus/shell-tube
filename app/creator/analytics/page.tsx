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
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8 md:px-10 md:py-12">
        <header className="app-panel rounded-[2rem] p-6 md:p-8">
          <p className="app-kicker">Creator analytics</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-5xl">A cleaner operating view of audience, quality, and payout signals.</h1>
          <p className="app-copy mt-3 max-w-3xl text-sm leading-7 md:text-base">
            This page is trimmed to the signals a creator actually needs: release volume, watch behavior, playback quality, and revenue movement.
          </p>
          <div className="flex flex-wrap gap-2 pt-4">
            <Link href="/creator/uploads" className="app-primary-button px-4 py-2 text-sm">
              Create course
            </Link>
            <Link href="/creator/courses" className="app-secondary-button px-4 py-2 text-sm">
              Open my courses
            </Link>
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Published courses</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.publishedCourseCount}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Published lessons</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.publishedLessonCount}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Average duration</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.averageDurationMin} min</p>
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
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Rebuffer events</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.totalRebufferEvents}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Fatal errors</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.totalFatalErrors}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Avg peer hit ratio</p>
            <p className="mt-1 text-2xl font-semibold">{analytics.averagePeerHitRatio}%</p>
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
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Settled course revenue</p>
            <p className="mt-1 text-2xl font-semibold">${revenue.settledCourseRevenueUsd.toFixed(2)}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Settled subscription share</p>
            <p className="mt-1 text-2xl font-semibold">${revenue.settledSubscriptionShareUsd.toFixed(2)}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Settled payout total</p>
            <p className="mt-1 text-2xl font-semibold">${revenue.totalSettledRevenueUsd.toFixed(2)}</p>
          </div>
        </div>
        <section className="app-panel space-y-3 rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-kicker">Revenue ledger</p>
              <h2 className="mt-2 text-2xl font-semibold">Payout movement</h2>
              <p className="mt-2 text-sm text-white/60">Revenue rows are grouped for creator readability. Raw formula payloads stay out of the main screen.</p>
            </div>
          </div>
          <div className="space-y-2">
            {revenue.payoutLedger.length > 0 ? revenue.payoutLedger.map((entry) => (
              <div key={entry.id} className="grid gap-3 rounded-[1.35rem] border border-white/10 bg-white/4 p-4 md:grid-cols-[1.2fr_0.8fr_0.6fr_0.7fr]">
                <div>
                  <p className="font-medium">{entry.courseTitle ?? "Platform-wide"}</p>
                  <p className="mt-1 text-xs text-white/55">{entry.sourceType}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Period</p>
                  <p className="mt-1 text-sm font-semibold">{entry.periodKey}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Amount</p>
                  <p className="mt-1 text-sm font-semibold">${entry.amountUsd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Status</p>
                  <p className="mt-1 text-sm font-semibold capitalize">{entry.status}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-white/10 px-3 py-5 text-sm text-white/55">
                No projected payout entries yet. Revenue placeholders appear when published lessons accumulate watch time or completion activity.
              </div>
            )}
          </div>
        </section>
        <section className="app-panel space-y-3 rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-kicker">Audience detail</p>
              <h2 className="mt-2 text-2xl font-semibold">Lesson performance</h2>
            </div>
            <p className="text-xs text-white/50">
              {effectiveRole === "admin" ? "Admin view across all creator content" : "Filtered to your owned courses"}
            </p>
          </div>
          <div className="space-y-2">
            {analytics.lessons.map((lesson) => (
              <div key={lesson.lessonId} className="grid gap-3 rounded-[1.35rem] border border-white/10 bg-white/4 p-4 md:grid-cols-[1.8fr_repeat(6,minmax(0,1fr))]">
                <div>
                  <p className="font-medium">{lesson.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">{lesson.publishStatus}</p>
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
