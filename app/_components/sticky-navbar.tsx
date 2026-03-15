import Link from "next/link";

import { getAuthContextFromHeaders } from "@/lib/server/auth";
import { getProfile } from "@/lib/server/data-store";

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default async function StickyNavbar() {
  const auth = await getAuthContextFromHeaders();
  if (!auth) return null;
  const profile = await getProfile(auth.userId);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070a14]/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 md:px-10">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#ff594f]">
            Shelby Stream
          </Link>
          <nav className="flex items-center gap-4 text-sm text-white/80">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/profile" className="hover:text-white">Profile</Link>
            {auth.role === "admin" ? <Link href="/admin" className="hover:text-white">Admin</Link> : null}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="avatar" className="h-8 w-8 rounded-full border border-white/20 object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs">
              {auth.userId.slice(2, 4).toUpperCase()}
            </div>
          )}
          <span className="text-xs text-white/70">{shortAddress(auth.userId)}</span>
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
