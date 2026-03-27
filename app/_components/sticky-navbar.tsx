import Link from "next/link";

import { canModeratePlatform, canViewCreatorAnalytics } from "@/lib/auth/capabilities";
import { NavbarLinks } from "@/app/_components/navbar-links";
import { getProfileFromProjection } from "@/lib/projections/profile-read-model";
import { getProfileRepository } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getEffectiveUserRole } from "@/lib/server/effective-role";

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default async function StickyNavbar() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) return null;
  const optionB = createOptionBConfig();
  const [profile, effectiveRole] = await Promise.all([
    optionB.projectionStoreBackend === "upstash"
      ? getProfileFromProjection(auth.userId)
      : getProfileRepository().getProfile(auth.userId),
    getEffectiveUserRole({
      userId: auth.userId,
      fallbackRole: auth.role,
    }),
  ]);
  const navItems = [
    { href: "/", label: "Home", match: "exact" as const },
    { href: "/courses", label: "Catalog" },
    { href: "/dashboard", label: "Watchlist" },
    { href: "/profile", label: "Profile" },
    ...(canViewCreatorAnalytics(effectiveRole)
      ? [
          { href: "/creator/uploads", label: "Studio" },
          { href: "/creator/courses", label: "Courses" },
          { href: "/creator/analytics", label: "Analytics" },
        ]
      : []),
    ...(canModeratePlatform(effectiveRole) ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#08111b]/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-10">
        <div className="flex min-w-0 items-center gap-3 md:gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-black text-[#f4a261]">
              VE
            </span>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-white">Verra</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden md:block">
            <NavbarLinks items={navItems} />
          </div>
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65 md:inline-flex">
            {effectiveRole}
          </span>
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="avatar" className="h-8 w-8 rounded-full border border-white/20 object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs">
              {auth.userId.slice(2, 4).toUpperCase()}
            </div>
          )}
          <span className="hidden text-xs text-white/60 sm:inline">{shortAddress(auth.userId)}</span>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">
              Logout
            </button>
          </form>
        </div>

        <div className="w-full md:hidden">
          <NavbarLinks items={navItems} />
        </div>
      </div>
    </header>
  );
}
