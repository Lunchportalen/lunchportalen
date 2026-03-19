// app/admin/AdminNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function tabClass(active: boolean) {
  return [
    "lp-motion-btn inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ring-1",
    active
      ? "bg-black text-white ring-black"
      : "bg-white text-[rgb(var(--lp-text))] ring-[rgb(var(--lp-border))] hover:bg-[rgb(var(--lp-surface))]",
  ].join(" ");
}

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

/**
 * Avensia-nivå / Enterprise IA:
 * - Få valg
 * - Tydelig mental modell
 * - Ingen "dashboard" som inviterer til drift
 *
 * Admin (firma) skal:
 * 1) Se avtale/rammer (oversikt)
 * 2) Administrere ansatte
 * 3) Se historikk (ordre + faktura)
 */
export default function AdminNav() {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/admin", label: "Avtale", exact: true },
    { href: "/admin/users", label: "Ansatte" },
    { href: "/admin/orders", label: "Historikk" },
  ];

  return (
    <nav aria-label="Admin navigation" className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const active = isActive(pathname, item.href, item.exact);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={tabClass(active)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
