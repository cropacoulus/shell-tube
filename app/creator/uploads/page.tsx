import Link from "next/link";

import { ClientAuthGate } from "@/app/_components/client-auth";
import { SectionSubnav } from "@/app/_components/section-subnav";
import StickyNavbar from "@/app/_components/sticky-navbar";
import CreatorUploadClient from "@/app/creator/uploads/creator-upload-client";

export default function CreatorUploadsPage() {
  return (
    <div className="app-shell">
      <StickyNavbar />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8 md:px-10 md:py-12">
        <ClientAuthGate
          allowedRoles={["creator", "admin"]}
          deniedTitle="Creator access required"
          deniedCopy="This wallet does not currently have creator publishing access."
        >
          <>
            <header className="app-panel rounded-[2rem] p-6 md:p-8">
              <p className="app-kicker">Creator studio</p>
              <h1 className="mt-3 text-3xl font-semibold md:text-5xl">Move every release from draft to playback-ready, then publish.</h1>
              <p className="app-copy mt-3 max-w-3xl text-sm leading-7 md:text-base">
                The studio now follows a clearer release path: create the shell, attach source media, wait until a watch-ready manifest exists, then make the course public only when playback is actually ready.
              </p>
            </header>

            <SectionSubnav
              items={[
                { href: "/creator/uploads", label: "Studio", match: "exact" },
                { href: "/creator/courses", label: "My Courses" },
                { href: "/creator/analytics", label: "Analytics" },
              ]}
            />

            <section className="grid gap-4 md:grid-cols-3">
              <article className="metric-card"><p className="app-kicker">Step 1</p><h2 className="mt-2 text-lg font-semibold">Create a draft</h2><p className="mt-2 text-sm leading-7 text-white/68">Start with title, category, imagery, and synopsis. Drafts stay private until you choose to publish.</p></article>
              <article className="metric-card"><p className="app-kicker">Step 2</p><h2 className="mt-2 text-lg font-semibold">Attach and process media</h2><p className="mt-2 text-sm leading-7 text-white/68">Upload a source file anytime. The release stays in a processing state until an HLS manifest exists.</p></article>
              <article className="metric-card"><p className="app-kicker">Step 3</p><h2 className="mt-2 text-lg font-semibold">Make it public</h2><p className="mt-2 text-sm leading-7 text-white/68">Publishing is only unlocked once a manifest is attached, so the public catalog never exposes half-ready lessons.</p></article>
            </section>

            <section className="flex flex-wrap gap-3">
              <Link href="/creator/courses" className="app-secondary-button px-4 py-2 text-sm">Open my courses</Link>
              <Link href="/creator/analytics" className="app-secondary-button px-4 py-2 text-sm">Open analytics</Link>
            </section>

            <CreatorUploadClient />
          </>
        </ClientAuthGate>
      </main>
    </div>
  );
}
