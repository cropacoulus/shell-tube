import Link from "next/link";
import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { listCourseSummaries } from "@/lib/server/course-flow";
import { getDashboardSnapshot } from "@/lib/server/dashboard-flow";

export default async function DashboardPage() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");

  const [courses, dashboard] = await Promise.all([
    listCourseSummaries(),
    getDashboardSnapshot(auth.userId),
  ]);

  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8 md:px-10 md:py-12">
        <header className="app-panel rounded-[2rem] p-6 md:p-8">
          <p className="app-kicker">Personal watchlist</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-5xl">Pick up right where your last lesson stopped.</h1>
          <p className="app-copy mt-3 max-w-3xl text-sm leading-7 md:text-base">
            Your dashboard keeps the learning path compact: what is available, what is active, and what deserves your next session.
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Catalog</p>
            <p className="mt-1 text-2xl font-semibold">{courses.length}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Active courses</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard.activeCourseCount}</p>
          </div>
          <div className="metric-card">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Completed lessons</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard.completedLessonCount}</p>
          </div>
        </div>
        <section className="app-panel space-y-4 rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-kicker">Resume sessions</p>
              <h2 className="mt-2 text-2xl font-semibold">Continue watching</h2>
            </div>
            <Link href="/courses" className="app-secondary-button px-4 py-2 text-sm">
              Explore catalog
            </Link>
          </div>
          {dashboard.continueWatching.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {dashboard.continueWatching.map((item) => (
                <Link
                  key={item.titleId}
                  href={`/lesson/${item.titleId}`}
                  className="rounded-[1.35rem] border border-white/10 bg-white/4 p-4 transition hover:bg-white/8"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{item.title}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">{item.remainingMin} min remaining</p>
                    </div>
                    <span className="status-pill">{item.progressPercent}% done</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#f4a261]" style={{ width: `${item.progressPercent}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-white/3 px-4 py-6 text-sm text-white/68">
              No in-progress lessons yet. Start any course and the next session will appear here automatically.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
