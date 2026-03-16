import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import StreamPlayer from "@/app/watch/[titleId]/stream-player";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getCourseById, getLessonById } from "@/lib/server/course-flow";

type PageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function LessonPage({ params }: PageProps) {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");

  const { lessonId } = await params;
  const lesson = await getLessonById(lessonId);
  if (!lesson) notFound();

  const course = await getCourseById(lesson.courseId);
  if (!course) notFound();

  return (
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-6 md:space-y-6 md:px-10 md:py-8">
        <Link href={`/courses/${course.id}`} className="inline-block text-sm text-white/70 hover:text-white">
          Back to course
        </Link>
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-[#ff594f]">Lesson Playback</p>
          <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{lesson.title}</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-white/75">{lesson.description}</p>
        </header>
        <StreamPlayer titleId={lesson.id} region={auth.region} />
      </div>
    </div>
  );
}
