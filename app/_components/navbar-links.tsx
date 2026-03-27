"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  match?: "exact" | "prefix";
};

function isActivePath(pathname: string, item: NavItem) {
  if (item.href === "/") return pathname === "/";
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function linkClassName(active: boolean) {
  return active
    ? "rounded-full border border-[#f4a261]/30 bg-[#f4a261]/16 px-3 py-2 text-white shadow-[0_0_0_1px_rgba(244,162,97,0.08)]"
    : "rounded-full px-3 py-2 text-white/78 hover:bg-white/10 hover:text-white";
}

export function NavbarLinks({
  items,
}: {
  items: NavItem[];
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/82 md:hidden"
        onClick={() => setMobileOpen((value) => !value)}
        aria-expanded={mobileOpen}
        aria-controls="navbar-links-panel"
      >
        {mobileOpen ? "Close" : "Menu"}
      </button>

      <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-sm whitespace-nowrap md:flex">
        {items.map((item) => {
          const active = isActivePath(pathname, item);
          return (
            <Link key={item.href} href={item.href} className={linkClassName(active)} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {mobileOpen ? (
        <nav
          id="navbar-links-panel"
          className="w-full rounded-[1.6rem] border border-white/10 bg-[#0a1623]/96 p-2 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.28)] md:hidden"
        >
          <div className="grid gap-1">
            {items.map((item) => {
              const active = isActivePath(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={
                    active
                      ? "rounded-2xl border border-[#f4a261]/30 bg-[#f4a261]/14 px-4 py-3 font-semibold text-white"
                      : "rounded-2xl px-4 py-3 text-white/76 hover:bg-white/7 hover:text-white"
                  }
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </>
  );
}
