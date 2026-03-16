import Link from "next/link";
import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { listCourseSummaries } from "@/lib/server/course-flow";

export default async function CoursesPage() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");

  const courses = await listCourseSummaries();

  return (
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8 md:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-[#ff594f]">Course Discovery</p>
          <h1 className="text-3xl font-semibold">Courses</h1>
          <p className="text-sm text-white/70">Browse published courses and continue to lesson playback.</p>
        </header>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <article key={course.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#10141f]">
              <div
                className="h-36 bg-cover bg-center"
                style={{ backgroundImage: `url(${course.thumbnailUrl})` }}
              />
              <div className="space-y-2 p-4">
                <p className="text-xs uppercase tracking-wide text-white/60">{course.category}</p>
                <h2 className="text-lg font-semibold">{course.title}</h2>
                <p className="line-clamp-2 text-sm text-white/75">{course.description}</p>
                <div className="pt-1">
                  <Link href={`/courses/${course.id}`} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black">
                    Open Course
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
