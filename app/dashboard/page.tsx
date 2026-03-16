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
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8 md:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-[#ff594f]">Learning Dashboard</p>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-white/70">Continue your lessons and track your current learning catalog.</p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Available Courses</p>
            <p className="mt-1 text-2xl font-semibold">{courses.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Active Courses</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard.activeCourseCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10141f] p-4">
            <p className="text-xs text-white/60">Lessons Completed</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard.completedLessonCount}</p>
          </div>
        </div>
        <section className="space-y-3 rounded-2xl border border-white/10 bg-[#10141f] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Continue Watching</h2>
            <p className="text-xs text-white/50">{auth.profileId}</p>
          </div>
          {dashboard.continueWatching.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {dashboard.continueWatching.map((item) => (
                <Link
                  key={item.titleId}
                  href={`/lesson/${item.titleId}`}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                >
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-white/60">{item.progressPercent}% watched</p>
                  <p className="mt-2 text-xs text-white/75">{item.remainingMin} min remaining</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/70">No in-progress lessons yet. Start a lesson and your progress will appear here.</p>
          )}
        </section>
        <Link href="/courses" className="inline-block rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">
          Browse Courses
        </Link>
      </main>
    </div>
  );
}
