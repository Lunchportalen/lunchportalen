// app/admin/AdminNav.tsx — Company admin control tower (én IA, /admin canonical)
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function tabClass(active: boolean) {
  return [
    "lp-motion-btn inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ring-1 sm:px-4",
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
 * Én navigasjon for company_admin: samme lenker som kontrolltårnet peker på (ingen duplikat flate).
 * Faktura: CSV-eksport (eksisterende API) — ikke en egen «fakturamotor».
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Oversikt", exact: true },
  { href: "/admin/users", label: "Ansatte" },
  { href: "/admin/locations", label: "Lokasjoner" },
  { href: "/admin/agreement", label: "Avtale" },
  { href: "/admin/insights", label: "Økonomi" },
  { href: "/api/admin/invoices/csv", label: "Faktura (CSV)" },
  { href: "/admin/orders", label: "Historikk" },
  { href: "/admin/history", label: "Aktivitet" },
  { href: "/admin/control-tower", label: "Kontrolltårn" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigasjon" className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        const isExternalApi = item.href.startsWith("/api/");
        if (isExternalApi) {
          return (
            <a
              key={item.href}
              href={item.href}
              className={tabClass(false)}
              rel="noopener noreferrer"
            >
              {item.label}
            </a>
          );
        }
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
