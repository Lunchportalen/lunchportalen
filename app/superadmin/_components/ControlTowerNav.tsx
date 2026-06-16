"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY_NAV = [
  { label: "Kontrollsenter", href: "/superadmin" },
  { label: "Firma", href: "/superadmin/companies" },
  { label: "Avtaler", href: "/superadmin/agreements" },
  { label: "Brukere", href: "/superadmin/users" },
  { label: "Kjøkken", href: "/kitchen" },
  { label: "Systemhelse", href: "/superadmin/system" },
  { label: "Backoffice", href: "/backoffice/content" },
];

const SECONDARY_NAV = [
  { label: "Revisjon", href: "/superadmin/audit" },
  { label: "Pilotkontroll", href: "/superadmin/pilot-control" },
  { label: "Tripletex", href: "/superadmin/tripletex" },
  { label: "Kontrolltårn", href: "/superadmin/control-tower" },
  { label: "Operasjoner", href: "/superadmin/operations" },
  { label: "Global", href: "/superadmin/global" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/superadmin") {
    return pathname === "/superadmin" || pathname === "/superadmin/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navClass(active: boolean, compact = false): string {
  return [
    "flex items-center rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
    compact ? "min-h-[36px] px-3 text-xs" : "min-h-[44px] px-3 text-sm",
    active ? "bg-neutral-950 text-white shadow-sm" : "text-[rgb(var(--lp-muted))] hover:bg-white/90 hover:text-[rgb(var(--lp-fg))]",
  ].join(" ");
}

export default function ControlTowerNav() {
  const path = usePathname();

  return (
    <>
      <Link
        href="/"
        className="flex min-h-[64px] items-center rounded-[1.25rem] px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        aria-label="Lunchportalen hjem"
      >
        <Image
          src="/brand/LP-logo-uten-bakgrunn.png"
          alt="Lunchportalen"
          width={160}
          height={64}
          className="h-12 w-auto object-contain"
          priority
        />
      </Link>

      <nav aria-label="Superadmin hovedmeny" className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
        {PRIMARY_NAV.map((item) => (
          <Link key={item.href} href={item.href} className={navClass(isActive(path, item.href))}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 border-t border-black/[0.06] pt-3">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--lp-muted))]">Flere</p>
        <nav aria-label="Flere superadmin-innganger" className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
          {SECONDARY_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={navClass(isActive(path, item.href), true)}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
