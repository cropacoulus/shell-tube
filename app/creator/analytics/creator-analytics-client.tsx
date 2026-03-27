"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { authFetch } from "@/lib/client/auth-fetch";

type CreatorAnalyticsApiResponse = {
  effectiveRole: "student" | "creator" | "admin";
  analytics: {
    publishedCourseCount: number;
    publishedLessonCount: number;
    averageDurationMin: number;
    totalViews: number;
    totalWatchTimeMin: number;
    averageCompletionRate: number;
    totalRebufferEvents: number;
    totalFatalErrors: number;
    averagePeerHitRatio: number;
    lessons: Array<{
      lessonId: string;
      title: string;
      publishStatus: "draft" | "published";
      views: number;
      watchTimeMin: number;
      completionRate: number;
      rebufferEvents: number;
      averagePeerHitRatio: number;
    }>;
  };
  revenue: {
    projectedCourseRevenueUsd: number;
    projectedSubscriptionShareUsd: number;
    totalProjectedRevenueUsd: number;
    settledCourseRevenueUsd: number;
    settledSubscriptionShareUsd: number;
    totalSettledRevenueUsd: number;
    payoutLedger: Array<{
      id: string;
      courseTitle?: string;
      sourceType: string;
      periodKey: string;
      amountUsd: number;
      status: string;
    }>;
  };
};

export default function CreatorAnalyticsClient() {
  const [data, setData] = useState<CreatorAnalyticsApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await authFetch("/api/v1/creator/analytics");
      const body = (await response.json().catch(() => null)) as
        | { data?: CreatorAnalyticsApiResponse; error?: { message?: string } }
        | null;
      if (!active) return;
      if (!response.ok || !body?.data) {
        setError(body?.error?.message || "Unable to load creator analytics.");
        return;
      }
      setData(body.data);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return <section className="app-panel rounded-[2rem] p-6 text-sm text-rose-300">{error}</section>;
  }

  if (!data) {
    return <section className="app-panel rounded-[2rem] p-6 text-sm text-white/70">Loading creator analytics…</section>;
  }

  const { analytics, revenue, effectiveRole } = data;

  return (
    <>
      <header className="app-panel rounded-[2rem] p-6 md:p-8">
        <p className="app-kicker">Creator analytics</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-5xl">A cleaner operating view of audience, quality, and payout signals.</h1>
        <p className="app-copy mt-3 max-w-3xl text-sm leading-7 md:text-base">
          This page is trimmed to the signals a creator actually needs: release volume, watch behavior, playback quality, and revenue movement.
        </p>
        <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:flex-wrap">
          <Link href="/creator/uploads" className="app-primary-button w-full px-4 py-2.5 text-sm sm:w-auto">
            Create course
          </Link>
          <Link href="/creator/courses" className="app-secondary-button w-full px-4 py-2.5 text-sm sm:w-auto">
            Open my courses
          </Link>
        </div>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Published courses</p><p className="mt-1 text-2xl font-semibold">{analytics.publishedCourseCount}</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Published lessons</p><p className="mt-1 text-2xl font-semibold">{analytics.publishedLessonCount}</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Average duration</p><p className="mt-1 text-2xl font-semibold">{analytics.averageDurationMin} min</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Total views</p><p className="mt-1 text-2xl font-semibold">{analytics.totalViews}</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Watch time</p><p className="mt-1 text-2xl font-semibold">{analytics.totalWatchTimeMin} min</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Average completion</p><p className="mt-1 text-2xl font-semibold">{analytics.averageCompletionRate}%</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Rebuffer events</p><p className="mt-1 text-2xl font-semibold">{analytics.totalRebufferEvents}</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Fatal errors</p><p className="mt-1 text-2xl font-semibold">{analytics.totalFatalErrors}</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Avg peer hit ratio</p><p className="mt-1 text-2xl font-semibold">{analytics.averagePeerHitRatio}%</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Projected course revenue</p><p className="mt-1 text-2xl font-semibold">${revenue.projectedCourseRevenueUsd.toFixed(2)}</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Projected subscription share</p><p className="mt-1 text-2xl font-semibold">${revenue.projectedSubscriptionShareUsd.toFixed(2)}</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Projected payout total</p><p className="mt-1 text-2xl font-semibold">${revenue.totalProjectedRevenueUsd.toFixed(2)}</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Settled course revenue</p><p className="mt-1 text-2xl font-semibold">${revenue.settledCourseRevenueUsd.toFixed(2)}</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Settled subscription share</p><p className="mt-1 text-2xl font-semibold">${revenue.settledSubscriptionShareUsd.toFixed(2)}</p></div>
        <div className="metric-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45">Settled payout total</p><p className="mt-1 text-2xl font-semibold">${revenue.totalSettledRevenueUsd.toFixed(2)}</p></div>
      </div>
      <section className="app-panel space-y-3 rounded-[2rem] p-6">
        <div>
          <p className="app-kicker">Revenue ledger</p>
          <h2 className="mt-2 text-2xl font-semibold">Payout movement</h2>
          <p className="mt-2 text-sm text-white/60">Revenue rows are grouped for creator readability. Raw formula payloads stay out of the main screen.</p>
        </div>
        <div className="space-y-2">
          {revenue.payoutLedger.length > 0 ? revenue.payoutLedger.map((entry) => (
            <div key={entry.id} className="grid gap-3 rounded-[1.35rem] border border-white/10 bg-white/4 p-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_0.6fr_0.7fr]">
              <div className="sm:col-span-2 xl:col-span-1"><p className="font-medium">{entry.courseTitle ?? "Platform-wide"}</p><p className="mt-1 text-xs text-white/55">{entry.sourceType}</p></div>
              <div><p className="text-xs uppercase tracking-[0.18em] text-white/45">Period</p><p className="mt-1 text-sm font-semibold">{entry.periodKey}</p></div>
              <div><p className="text-xs uppercase tracking-[0.18em] text-white/45">Amount</p><p className="mt-1 text-sm font-semibold">${entry.amountUsd.toFixed(2)}</p></div>
              <div><p className="text-xs uppercase tracking-[0.18em] text-white/45">Status</p><p className="mt-1 text-sm font-semibold capitalize">{entry.status}</p></div>
            </div>
          )) : (
            <div className="rounded-lg border border-dashed border-white/10 px-3 py-5 text-sm text-white/55">No projected payout entries yet.</div>
          )}
        </div>
      </section>
      <section className="app-panel space-y-3 rounded-[2rem] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="app-kicker">Audience detail</p><h2 className="mt-2 text-2xl font-semibold">Lesson performance</h2></div>
          <p className="text-xs text-white/50">{effectiveRole === "admin" ? "Admin view across all creator content" : "Filtered to your owned courses"}</p>
        </div>
        <div className="space-y-2">
          {analytics.lessons.map((lesson) => (
            <div key={lesson.lessonId} className="grid gap-3 rounded-[1.35rem] border border-white/10 bg-white/4 p-4 sm:grid-cols-2 xl:grid-cols-[1.8fr_repeat(5,minmax(0,1fr))]">
              <div className="sm:col-span-2 xl:col-span-1"><p className="font-medium">{lesson.title}</p><p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">{lesson.publishStatus}</p></div>
              <div><p className="text-xs text-white/55">Views</p><p className="mt-1 text-sm font-semibold">{lesson.views}</p></div>
              <div><p className="text-xs text-white/55">Watch Time</p><p className="mt-1 text-sm font-semibold">{lesson.watchTimeMin} min</p></div>
              <div><p className="text-xs text-white/55">Completion</p><p className="mt-1 text-sm font-semibold">{lesson.completionRate}%</p></div>
              <div><p className="text-xs text-white/55">Rebuffers</p><p className="mt-1 text-sm font-semibold">{lesson.rebufferEvents}</p></div>
              <div><p className="text-xs text-white/55">Peer Hit</p><p className="mt-1 text-sm font-semibold">{lesson.averagePeerHitRatio}%</p></div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
