import Link from "next/link";

import { canModeratePlatform, canViewCreatorAnalytics } from "@/lib/auth/capabilities";
import { getProfileRepository } from "@/lib/repositories";
import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getEffectiveUserRole } from "@/lib/server/effective-role";

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default async function StickyNavbar() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) return null;
  const [profile, effectiveRole] = await Promise.all([
    getProfileRepository().getProfile(auth.userId),
    getEffectiveUserRole({
      userId: auth.userId,
      fallbackRole: auth.role,
    }),
  ]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070a14]/85 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-10">
        <div className="flex items-center gap-3 md:gap-5">
          <Link href="/" className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#ff594f] md:text-sm">
            Shelby Stream
          </Link>
          <nav className="flex max-w-[58vw] items-center gap-3 overflow-x-auto text-xs whitespace-nowrap text-white/80 md:max-w-none md:gap-4 md:text-sm">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/courses" className="hover:text-white">Courses</Link>
            <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
            <Link href="/profile" className="hover:text-white">Profile</Link>
            {canViewCreatorAnalytics(effectiveRole) ? (
              <>
                <Link href="/creator/uploads" className="hover:text-white">Creator Studio</Link>
                <Link href="/creator/courses" className="hover:text-white">My Courses</Link>
                <Link href="/creator/analytics" className="hover:text-white">Creator Analytics</Link>
              </>
            ) : null}
            {canModeratePlatform(effectiveRole) ? <Link href="/admin" className="hover:text-white">Admin</Link> : null}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="avatar" className="h-8 w-8 rounded-full border border-white/20 object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs">
              {auth.userId.slice(2, 4).toUpperCase()}
            </div>
          )}
          <span className="hidden text-xs text-white/70 sm:inline">{shortAddress(auth.userId)}</span>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-md border border-white/25 px-3 py-1 text-xs hover:bg-white/10">
              Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
