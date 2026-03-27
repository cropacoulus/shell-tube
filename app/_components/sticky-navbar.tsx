"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { canModeratePlatform, canViewCreatorAnalytics } from "@/lib/auth/capabilities";
import { authFetch } from "@/lib/client/auth-fetch";
import { clearStoredAccessToken } from "@/lib/client/access-token";
import { type AuthenticatedProfile, useAuthenticatedProfile } from "@/app/_components/client-auth";
import { NavbarLinks } from "@/app/_components/navbar-links";

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function buildNavItems(profile: AuthenticatedProfile | null) {
  const role = profile?.role ?? "student";
  return [
    { href: "/", label: "Home", match: "exact" as const },
    { href: "/courses", label: "Catalog" },
    ...(profile ? [{ href: "/dashboard", label: "Watchlist" }, { href: "/profile", label: "Profile" }] : []),
    ...(profile && canViewCreatorAnalytics(role)
      ? [
          { href: "/creator/uploads", label: "Studio" },
          { href: "/creator/courses", label: "Courses" },
          { href: "/creator/analytics", label: "Analytics" },
        ]
      : []),
    ...(profile && canModeratePlatform(role) ? [{ href: "/admin", label: "Admin" }] : []),
  ];
}

export default function StickyNavbar() {
  const router = useRouter();
  const { loading, profile } = useAuthenticatedProfile();
  const navItems = useMemo(() => buildNavItems(profile), [profile]);

  async function handleLogout() {
    clearStoredAccessToken();
    await authFetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/signin");
    router.refresh();
  }

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
          {loading ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/55">
              Checking wallet…
            </span>
          ) : profile ? (
            <>
              <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65 md:inline-flex">
                {profile.role}
              </span>
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="avatar" className="h-8 w-8 rounded-full border border-white/20 object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs">
                  {profile.userId.slice(2, 4).toUpperCase()}
                </div>
              )}
              <span className="hidden text-xs text-white/60 sm:inline">{shortAddress(profile.userId)}</span>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
              >
                Logout
              </button>
            </>
          ) : (
            <Link href="/signin" className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">
              Sign in
            </Link>
          )}
        </div>

        <div className="w-full md:hidden">
          <NavbarLinks items={navItems} />
        </div>
      </div>
    </header>
  );
}
