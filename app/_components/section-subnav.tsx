"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type SectionSubnavItem = {
  href: string;
  label: string;
  match?: "exact" | "prefix" | "hash";
};

function isActiveItem(pathname: string, hash: string, item: SectionSubnavItem) {
  if (item.match === "hash") {
    const targetHash = item.href.includes("#") ? `#${item.href.split("#")[1]}` : item.href;
    return hash === targetHash;
  }

  const url = item.href.split("#")[0] || "/";
  if (item.match === "exact" || url === "/") return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function SectionSubnav({
  items,
}: {
  items: SectionSubnavItem[];
}) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash || "");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <div className="overflow-x-auto">
      <nav className="flex min-w-max items-center gap-2 rounded-[1.6rem] border border-white/10 bg-white/5 p-2 text-sm">
        {items.map((item) => {
          const active = isActiveItem(pathname, hash, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-[1rem] border border-[#f4a261]/30 bg-[#f4a261]/14 px-4 py-2.5 font-semibold text-white"
                  : "rounded-[1rem] px-4 py-2.5 text-white/72 hover:bg-white/8 hover:text-white"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
