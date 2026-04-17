"use client";

// STATUS: KEEP

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function NavActiveClient({ rootId }: { rootId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[data-href]"));
    for (const a of links) {
      const href = a.getAttribute("data-href") || "";
      const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
      a.classList.toggle("lp-nav-item--active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  }, [pathname, rootId]);

  return null;
}
