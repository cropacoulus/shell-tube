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

  return (
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <section className="border-b border-white/10 bg-gradient-to-b from-[#10172a] to-[#06080f]">
        <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-16 md:px-10 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ff594f]">
            Creator-First Learning Platform
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Learn with Structured Courses Powered by Shelby Streaming
          </h1>
          <p className="max-w-2xl text-sm text-white/80 md:text-base">
            Browse courses, open lessons, and stream adaptive content with wallet-authenticated access.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/courses" className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90">
              Browse Courses
            </Link>
            <Link href="/dashboard" className="rounded-md border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/20">
              Open Dashboard
            </Link>
            {canModeratePlatform(auth.role) ? (
              <Link href="/admin" className="rounded-md border border-cyan-300/60 bg-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/25">
                Open Admin Console
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8 md:px-10">
        <section className="space-y-4 rounded-2xl border border-white/10 bg-[#10141f] p-5">
          <h2 className="text-xl font-semibold">Featured Course</h2>
          {featured ? (
            <div className="flex flex-col gap-4 md:flex-row">
              <div
                className="h-44 w-full rounded-xl bg-cover bg-center md:h-36 md:w-56"
                style={{ backgroundImage: `url(${featured.thumbnailUrl})` }}
              />
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-[#ff594f]">{featured.category}</p>
                <h3 className="text-2xl font-semibold">{featured.title}</h3>
                <p className="text-sm text-white/75">{featured.description}</p>
                <Link href={`/courses/${featured.id}`} className="inline-block rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">
                  Open Course
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/70">No course published yet. Add course content from Admin Console.</p>
          )}
        </section>
      </main>
    </div>
  );
}
