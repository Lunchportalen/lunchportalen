// components/superadmin/SuperadminNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function SuperadminNav() {
  const pathname = usePathname();

  const navItem = (href: string, label: string) => {
    const active = isActive(pathname, href);

    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={[
          "lp-motion-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1",
          active
            ? "bg-white font-extrabold ring-[rgb(var(--lp-border))]"
            : "bg-white/60 font-semibold text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))] hover:bg-white",
        ].join(" ")}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      className="mb-6 flex flex-wrap gap-2"
      aria-label="Superadmin navigation"
    >
      {navItem("/superadmin", "Dashboard")}
      {navItem("/superadmin/firms", "Firma")}
      {navItem("/superadmin/esg", "ESG")}
      {navItem("/superadmin/audit", "Audit")}
    </nav>
  );
}
