import Link from "next/link";
import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import { canPublishContent } from "@/lib/auth/capabilities";
import { listCreatorOwnedCourseSummaries } from "@/lib/server/creator-content-flow";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getEffectiveUserRole } from "@/lib/server/effective-role";

export default async function CreatorCoursesPage() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canPublishContent(effectiveRole)) redirect("/");

  const courses = await listCreatorOwnedCourseSummaries({
    profileId: auth.profileId,
    role: effectiveRole,
  });

  return (
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8 md:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-[#ff594f]">Creator Studio</p>
          <h1 className="text-3xl font-semibold">Courses Management</h1>
          <p className="text-sm text-white/70">
            Manage published course metadata and jump to full admin controls when needed.
          </p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-[#10141f] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Catalog Snapshot</h2>
            <Link href="/creator/uploads" className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black">
              Create Draft
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {courses.map((course) => (
              <article key={course.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-wide text-white/60">{course.category}</p>
                <h3 className="mt-1 text-base font-semibold">{course.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-white/75">{course.description}</p>
                <div className="mt-3 flex gap-2">
                  <Link href={`/creator/courses/${course.id}`} className="rounded-md border border-white/30 px-2 py-1 text-xs hover:bg-white/10">
                    Open Creator Detail
                  </Link>
                  <Link href="/creator/uploads" className="rounded-md border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/20">
                    Add New Draft
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
