import Link from "next/link";
import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import { canPublishContent } from "@/lib/auth/capabilities";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import CreatorUploadClient from "@/app/creator/uploads/creator-upload-client";

export default async function CreatorUploadsPage() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canPublishContent(effectiveRole)) redirect("/");

  return (
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8 md:px-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-[#ff594f]">Creator Studio</p>
          <h1 className="text-3xl font-semibold">Upload Pipeline</h1>
          <p className="text-sm text-white/70">
            Upload flow follows architecture reference: L1 registration first, then server-side Shelby ingest.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-[#10141f] p-5">
          <h2 className="text-lg font-semibold">Publishing Checklist</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-white/80">
            <li>Prepare metadata, then save a draft so Creator Studio can attach uploads to a stable lesson id.</li>
            <li>Upload source video from Creator Studio whenever you need a draft asset on Shelby storage.</li>
            <li>Upload HLS manifest when the lesson is ready for playback and publishing.</li>
            <li>Publish only after manifest ingest completes and lesson status is ready.</li>
            <li>Verify the lesson appears in discovery, lesson page, and creator analytics.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/creator/courses" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">
              Open Creator Courses
            </Link>
            <Link href="/creator/analytics" className="rounded-md border border-white/30 px-4 py-2 text-sm hover:bg-white/10">
              Open Analytics
            </Link>
          </div>
        </section>

        <CreatorUploadClient />
      </main>
    </div>
  );
}
