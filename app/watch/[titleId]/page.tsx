import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import StreamPlayer from "@/app/watch/[titleId]/stream-player";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getTitleById } from "@/lib/services/catalog-client";

type PageProps = {
  params: Promise<{ titleId: string }>;
};

export default async function WatchPage({ params }: PageProps) {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");

  const { titleId } = await params;
  const title = await getTitleById(titleId);
  if (!title) notFound();

  return (
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-6 md:space-y-6 md:px-10 md:py-8">
        <Link href="/" className="inline-block text-sm text-white/70 hover:text-white">
          Back to browse
        </Link>
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{title.title}</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-white/75">{title.synopsis}</p>
        </header>
        <StreamPlayer titleId={titleId} region={auth.region} />
      </div>
    </div>
  );
}
