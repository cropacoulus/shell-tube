import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import StickyNavbar from "@/app/_components/sticky-navbar";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getHomePageData } from "@/lib/server/home";

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/30 bg-black/20 px-3 py-1 text-xs tracking-wide text-white/85">
      {children}
    </span>
  );
}

export default async function Home() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) redirect("/signin");

  const data = await getHomePageData(auth);

  return (
    <div className="min-h-screen bg-[#06080f] text-white">
      <StickyNavbar />
      <section
        className="relative min-h-[75vh] overflow-hidden border-b border-white/10"
        style={{
          backgroundImage: `linear-gradient(to top, rgba(6,8,15,1) 10%, rgba(6,8,15,.3) 55%, rgba(6,8,15,.8) 100%), url(${data.hero.heroImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="mx-auto flex min-h-[75vh] w-full max-w-7xl items-end px-6 pb-14 md:px-10">
          <div className="max-w-2xl space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#ff594f]">
              Stream P2P Originals
            </p>
            <h1 className="text-4xl font-bold leading-tight md:text-6xl">
              {data.hero.title}
            </h1>
            <p className="text-sm text-white/80 md:text-base">
              {data.hero.synopsis}
            </p>
            <div className="flex flex-wrap gap-2">
              <MetaChip>{data.hero.year}</MetaChip>
              <MetaChip>{data.hero.maturityRating}</MetaChip>
              <MetaChip>{data.hero.durationMin} min</MetaChip>
              <MetaChip>{data.hero.type}</MetaChip>
            </div>
            <div className="flex gap-3 pt-2">
              <Link
                href={`/watch/${data.hero.id}`}
                className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Play
              </Link>
              <button className="rounded-md border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/20">
                More Info
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl space-y-10 px-6 py-8 md:px-10">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Continue Watching</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.continueWatching.map((item) => (
              <article
                key={item.titleId}
                className="overflow-hidden rounded-xl border border-white/10 bg-[#10141f]"
              >
                <div
                  className="h-28 bg-cover bg-center"
                  style={{ backgroundImage: `url(${item.cardImageUrl})` }}
                />
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <span className="text-xs text-white/70">
                      {item.remainingMin}m left
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/20">
                    <div
                      className="h-1.5 rounded-full bg-[#ff594f]"
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {data.rails.map((rail) => (
          <section key={rail.id} className="space-y-4">
            <h2 className="text-xl font-semibold">{rail.label}</h2>
            <div className="flex snap-x gap-4 overflow-x-auto pb-2">
              {rail.titles.map((title) => (
                <article
                  key={title.id}
                  className="group min-w-[220px] snap-start overflow-hidden rounded-lg border border-white/10 bg-[#111827] transition hover:-translate-y-1 hover:border-white/30"
                >
                  <Link href={`/watch/${title.id}`} className="block">
                  <div
                    className="h-32 bg-cover bg-center"
                    style={{ backgroundImage: `url(${title.cardImageUrl})` }}
                  />
                  <div className="space-y-2 p-3">
                    <h3 className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">
                      {title.title}
                    </h3>
                    <p className="h-8 overflow-hidden text-xs text-white/75">
                      {title.synopsis}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-white/60">
                      {title.genres.join(" • ")}
                    </p>
                  </div>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
