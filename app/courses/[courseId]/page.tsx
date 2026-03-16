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
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8 md:px-10">
        <Link href="/courses" className="text-sm text-white/70 hover:text-white">Back to courses</Link>
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#10141f]">
          <div
            className="h-56 bg-cover bg-center"
            style={{ backgroundImage: `linear-gradient(to top, rgba(16,20,31,.95), rgba(16,20,31,.25)), url(${course.thumbnailUrl})` }}
          />
          <div className="space-y-3 p-5">
            <p className="text-xs uppercase tracking-wide text-[#ff594f]">{course.category}</p>
            <h1 className="text-3xl font-semibold">{course.title}</h1>
            <p className="text-sm text-white/75">{course.description}</p>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-[#10141f] p-5">
          <h2 className="text-xl font-semibold">Lessons</h2>
          {lessonsWithEntitlement.map((lesson, index) => (
            <div key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
              <div>
                <p className="text-sm text-white/60">Lesson {index + 1}</p>
                <p className="text-base font-medium">{lesson.title}</p>
                <p className={`text-xs ${lesson.allowed ? "text-emerald-300" : "text-amber-200"}`}>
                  {lesson.allowed ? "Unlocked" : lesson.reason || "Locked"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/60">{lesson.durationMin} min</span>
                {lesson.allowed ? (
                  <Link href={`/lesson/${lesson.id}`} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black">
                    Start Lesson
                  </Link>
                ) : (
                  <span className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/70">
                    Locked
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
