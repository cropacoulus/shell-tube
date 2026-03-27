import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getCourseById, listLessonsByCourse } from "@/lib/server/course-flow";
import { checkEntitlement } from "@/lib/services/entitlement-client";
import { ServiceError } from "@/lib/services/http-client";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CourseDetailPage({ params }: PageProps) {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");

  const { courseId } = await params;
  const [course, lessons] = await Promise.all([getCourseById(courseId), listLessonsByCourse(courseId)]);
  if (!course) notFound();
  const lessonsWithEntitlement = await Promise.all(
    lessons.map(async (lesson) => {
      try {
        const entitlement = await checkEntitlement({
          userId: auth.userId,
          profileId: auth.profileId,
          titleId: lesson.id,
          region: auth.region,
        });
        return {
          ...lesson,
          allowed: entitlement.allowed,
          reason: entitlement.reason,
        };
      } catch (error) {
        if (error instanceof ServiceError) {
          return {
            ...lesson,
            allowed: false,
            reason: error.message,
          };
        }
        return {
          ...lesson,
          allowed: false,
          reason: "Entitlement check failed",
        };
      }
    }),
  );

  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8 md:px-10 md:py-12">
        <Link href="/courses" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">Back to catalog</Link>
        <section className="app-panel overflow-hidden rounded-[2rem]">
          <div
            className="h-64 bg-cover bg-center"
            style={{ backgroundImage: `linear-gradient(180deg, rgba(7,17,29,0.16), rgba(7,17,29,0.88)), url(${course.thumbnailUrl})` }}
          />
          <div className="space-y-4 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="status-pill">{course.category}</span>
              <span className="status-pill">{lessons.length} lesson{lessons.length === 1 ? "" : "s"}</span>
            </div>
            <h1 className="text-3xl font-semibold md:text-5xl">{course.title}</h1>
            <p className="max-w-3xl text-sm leading-7 text-white/72 md:text-base">{course.description}</p>
          </div>
        </section>

        <section className="app-panel space-y-4 rounded-[2rem] p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="app-kicker">Lesson lineup</p>
              <h2 className="mt-2 text-2xl font-semibold">Watch path</h2>
            </div>
          </div>
          {lessonsWithEntitlement.map((lesson, index) => (
            <div key={lesson.id} className="rounded-[1.35rem] border border-white/10 bg-white/4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Lesson {index + 1}</p>
                  <p className="text-lg font-semibold">{lesson.title}</p>
                  <p className={`text-xs uppercase tracking-[0.18em] ${lesson.allowed ? "text-emerald-300" : "text-amber-200"}`}>
                    {lesson.allowed ? "Available now" : lesson.reason || "Access pending"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="status-pill">{lesson.durationMin} min</span>
                  {lesson.allowed ? (
                    <Link href={`/lesson/${lesson.id}`} className="app-primary-button px-4 py-2 text-sm">
                      Start lesson
                    </Link>
                  ) : (
                    <span className="app-secondary-button cursor-not-allowed px-4 py-2 text-sm opacity-70">
                      Locked
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
