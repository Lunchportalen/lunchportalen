"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY_NAV = [
  { label: "Kontrollsenter", href: "/superadmin" },
  { label: "Morgenoversikt", href: "/superadmin/daily-brief" },
  { label: "Driftsoversikt", href: "/superadmin/overview" },
  { label: "Firma", href: "/superadmin/companies" },
  { label: "Avtaler", href: "/superadmin/agreements" },
  { label: "Brukere", href: "/superadmin/users" },
  { label: "Kjøkken", href: "/kitchen" },
  { label: "Backoffice", href: "/backoffice/content" },
  { label: "Systemhelse", href: "/superadmin/system" },
];

const SECONDARY_NAV = [
  { label: "Kontrolltårn", href: "/superadmin/control-tower" },
  { label: "Operasjoner", href: "/superadmin/operations" },
  { label: "Global", href: "/superadmin/global" },
  { label: "Vekst", href: "/superadmin/growth/social" },
  { label: "Pipeline", href: "/superadmin/pipeline" },
  { label: "Investor", href: "/superadmin/investor" },
  { label: "AI CTO", href: "/superadmin/cto" },
  { label: "Salg", href: "/superadmin/sales" },
  { label: "Salgsloop", href: "/superadmin/sales-loop" },
  { label: "Salgsagent", href: "/superadmin/sales-agent" },
  { label: "Produksjonssjekk", href: "/superadmin/production-check" },
  { label: "Systemgraf", href: "/superadmin/system-graph" },
  { label: "AI-strategi", href: "/superadmin/strategy" },
  { label: "Autonomi", href: "/superadmin/autonomy" },
  { label: "Eksperimenter", href: "/superadmin/experiments" },
  { label: "Revisjon", href: "/superadmin/audit" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/superadmin") {
    return pathname === "/superadmin" || pathname === "/superadmin/";
  }
  if (href === "/superadmin/overview") {
    return pathname === "/superadmin/overview" || pathname === "/superadmin/overview/";
  }
  if (href === "/superadmin/daily-brief") {
    return pathname === "/superadmin/daily-brief" || pathname === "/superadmin/daily-brief/";
  }
  if (href === "/superadmin/sales") {
    return pathname === "/superadmin/sales" || pathname === "/superadmin/sales/";
  }
  if (href === "/superadmin/sales-loop") {
    return pathname === "/superadmin/sales-loop" || pathname === "/superadmin/sales-loop/";
  }
  if (href === "/superadmin/global") {
    return pathname === "/superadmin/global" || pathname === "/superadmin/global/";
  }
  if (href === "/superadmin/investor") {
    return pathname === "/superadmin/investor" || pathname === "/superadmin/investor/";
  }
  if (href === "/superadmin/strategy") {
    return pathname === "/superadmin/strategy" || pathname === "/superadmin/strategy/";
  }
  if (href === "/superadmin/autonomy") {
    return pathname === "/superadmin/autonomy" || pathname === "/superadmin/autonomy/";
  }
  if (href === "/superadmin/experiments") {
    return pathname === "/superadmin/experiments" || pathname === "/superadmin/experiments/";
  }
  if (href === "/superadmin/cto") {
    return pathname === "/superadmin/cto" || pathname === "/superadmin/cto/";
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
