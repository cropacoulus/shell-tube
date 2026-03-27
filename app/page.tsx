import Link from "next/link";
import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import { canModeratePlatform } from "@/lib/auth/capabilities";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { listCourseSummaries } from "@/lib/server/course-flow";

export default async function Home() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");

  const courses = await listCourseSummaries();
  const featured = courses[0] ?? null;
  const spotlight = courses.slice(0, 3);

  return (
    <div className="app-shell">
      <StickyNavbar />
      <section className="border-b border-white/10">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-14 md:grid-cols-[1.15fr_0.85fr] md:px-10 md:py-18">
          <div className="space-y-6">
            <p className="app-kicker">Creator-owned learning platform</p>
            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.05] md:text-6xl">
              Structured learning, wallet-native access, and Verra delivery in one platform.
            </h1>
            <p className="app-copy max-w-2xl text-sm leading-7 md:text-base">
              Build a premium course catalog, publish lessons with proof-aware distribution, and keep creators close to their audience instead of hiding behind generic LMS tooling.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/courses" className="app-primary-button px-5 py-3 text-sm">
                Explore Catalog
              </Link>
              <Link href="/dashboard" className="app-secondary-button px-5 py-3 text-sm">
                Open Watchlist
              </Link>
              <Link href="/creator/uploads" className="app-secondary-button px-5 py-3 text-sm">
                Open Creator Studio
              </Link>
              {canModeratePlatform(auth.role) ? (
                <Link href="/admin" className="app-secondary-button px-5 py-3 text-sm">
                  Admin Console
                </Link>
              ) : null}
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <div className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Distribution</p>
                <p className="mt-2 text-lg font-semibold">Verra delivery powered by Shelby</p>
              </div>
              <div className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Identity</p>
                <p className="mt-2 text-lg font-semibold">Wallet-authenticated access</p>
              </div>
              <div className="metric-card">
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Studio</p>
                <p className="mt-2 text-lg font-semibold">Creator workflow from draft to publish</p>
              </div>
            </div>
          </div>

          <div className="app-panel overflow-hidden rounded-[2rem]">
            <div className="border-b border-white/10 p-6">
              <p className="app-kicker">Featured release</p>
              {featured ? (
                <>
                  <h2 className="mt-3 text-2xl font-semibold">{featured.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-white/72">{featured.description}</p>
                  <div className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45">
                    <span>{featured.category}</span>
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                    <span>Published</span>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-3 text-2xl font-semibold">No public release yet</h2>
                  <p className="mt-3 text-sm leading-7 text-white/72">
                    Start by creating a draft in Creator Studio, attach a manifest, and the first course will appear here automatically.
                  </p>
                </>
              )}
            </div>

            {featured ? (
              <div className="space-y-4 p-6">
                <div
                  className="h-52 rounded-[1.5rem] bg-cover bg-center"
                  style={{ backgroundImage: `linear-gradient(180deg, rgba(7,17,29,0.08), rgba(7,17,29,0.72)), url(${featured.thumbnailUrl})` }}
                />
                <Link href={`/courses/${featured.id}`} className="app-primary-button w-full px-5 py-3 text-sm">
                  Open Featured Course
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 md:px-10 md:py-12">
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="app-kicker">Now in catalog</p>
              <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Courses designed for structured viewing</h2>
            </div>
            <Link href="/courses" className="app-secondary-button px-4 py-2 text-sm">
              See all courses
            </Link>
          </div>
          {spotlight.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {spotlight.map((course) => (
                <article key={course.id} className="app-panel overflow-hidden rounded-[1.6rem]">
                  <div
                    className="h-44 bg-cover bg-center"
                    style={{ backgroundImage: `linear-gradient(180deg, rgba(7,17,29,0.08), rgba(7,17,29,0.7)), url(${course.thumbnailUrl})` }}
                  />
                  <div className="space-y-3 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#f4a261]">{course.category}</p>
                    <h3 className="text-xl font-semibold">{course.title}</h3>
                    <p className="line-clamp-3 text-sm leading-7 text-white/68">{course.description}</p>
                    <Link href={`/courses/${course.id}`} className="app-secondary-button px-4 py-2 text-sm">
                      Open course
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="app-panel rounded-[1.6rem] p-6">
              <p className="text-sm text-white/72">
                No course is public yet. The first published lesson will immediately populate discovery, course pages, and lesson playback.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
