import Link from "next/link";

import StickyNavbar from "@/app/_components/sticky-navbar";
import { listCourseSummaries } from "@/lib/server/course-flow";

export default async function CoursesPage() {
  const courses = await listCourseSummaries();

  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 md:px-10 md:py-12">
        <header className="app-panel rounded-[2rem] p-6 md:p-8">
          <p className="app-kicker">Public catalog</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-5xl">Browse structured courses built for streamed learning.</h1>
          <p className="app-copy mt-3 max-w-3xl text-sm leading-7 md:text-base">
            Every published course here already has a watch-ready lesson path. Open a course, review the lesson lineup, and continue directly into playback.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <article key={course.id} className="app-panel overflow-hidden rounded-[1.6rem]">
              <div
                className="h-44 bg-cover bg-center"
                style={{ backgroundImage: `linear-gradient(180deg, rgba(7,17,29,0.08), rgba(7,17,29,0.74)), url(${course.thumbnailUrl})` }}
              />
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#f4a261]">{course.category}</p>
                  <span className="status-pill">Published</span>
                </div>
                <h2 className="text-xl font-semibold">{course.title}</h2>
                <p className="line-clamp-3 text-sm leading-7 text-white/70">{course.description}</p>
                <div className="pt-2">
                  <Link href={`/courses/${course.id}`} className="app-secondary-button px-4 py-2 text-sm">
                    Open course
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
