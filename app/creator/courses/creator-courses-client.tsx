"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { authFetch } from "@/lib/client/auth-fetch";

type CourseSummary = {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string;
};

export default function CreatorCoursesClient() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await authFetch("/api/v1/creator/courses");
      const body = (await response.json().catch(() => null)) as
        | { data?: { courses: CourseSummary[] }; error?: { message?: string } }
        | null;
      if (!active) return;
      if (!response.ok || !body?.data) {
        setError(body?.error?.message || "Unable to load creator courses.");
        return;
      }
      setCourses(body.data.courses);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (error) return <section className="app-panel rounded-[2rem] p-6 text-sm text-rose-300">{error}</section>;
  if (!courses) return <section className="app-panel rounded-[2rem] p-6 text-sm text-white/70">Loading creator library…</section>;

  return (
    <>
      <header className="app-panel rounded-[2rem] p-6 md:p-8">
        <p className="app-kicker">Creator library</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-5xl">See every course you own in one operational view.</h1>
        <p className="app-copy mt-3 max-w-3xl text-sm leading-7 md:text-base">
          This is the clean catalog view for your public and private releases. Open a course to inspect performance, or jump back into Studio to shape the next draft.
        </p>
      </header>

      <div className="app-panel rounded-[2rem] p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="app-kicker">Owned catalog</p>
            <h2 className="mt-2 text-2xl font-semibold">Courses</h2>
          </div>
          <Link href="/creator/uploads" className="app-primary-button px-4 py-2 text-sm">Create draft</Link>
        </div>
        {courses.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {courses.map((course) => (
              <article key={course.id} className="rounded-[1.4rem] border border-white/10 bg-white/4 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#f4a261]">{course.category}</p>
                  <span className="status-pill">Owned</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold">{course.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-7 text-white/70">{course.description}</p>
                <div className="mt-4 flex gap-2">
                  <Link href={`/creator/courses/${course.id}`} className="app-secondary-button px-4 py-2 text-sm">Open details</Link>
                  <Link href="/creator/uploads" className="app-secondary-button px-4 py-2 text-sm">Open studio</Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/3 px-4 py-8 text-sm text-white/68">
            You do not own any course yet. Start with a draft in Creator Studio and your catalog will appear here.
          </div>
        )}
      </div>
    </>
  );
}
