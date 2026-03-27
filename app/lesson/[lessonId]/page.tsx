import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import StreamPlayer from "@/app/watch/[titleId]/stream-player";
import { getLessonDetailFromProjection } from "@/lib/projections/lesson-detail-read-model";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getCourseById, getLessonById } from "@/lib/server/course-flow";

type PageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function LessonPage({ params }: PageProps) {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");

  const { lessonId } = await params;
  const optionB = createOptionBConfig();
  let lesson = await getLessonById(lessonId);
  let course = lesson ? await getCourseById(lesson.courseId) : null;

  if (optionB.projectionStoreBackend === "upstash") {
    const detail = await getLessonDetailFromProjection(lessonId);
    if (!detail) notFound();
    lesson = detail.lesson;
    course = detail.course;
  }

  if (!lesson || !course) notFound();

  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 md:px-10 md:py-10">
        <Link href={`/courses/${course.id}`} className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
          Back to course
        </Link>
        <section className="app-panel rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="status-pill">{course.category}</span>
            <span className="status-pill">{course.title}</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold leading-tight md:text-4xl">{lesson.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72 md:text-base">{lesson.description}</p>
        </section>
        <div className="app-panel rounded-[2rem] p-3 md:p-4">
          <StreamPlayer titleId={lesson.id} region={auth.region} />
        </div>
      </main>
    </div>
  );
}
