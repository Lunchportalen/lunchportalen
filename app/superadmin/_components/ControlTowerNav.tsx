"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export default function ControlTowerNav() {
  const path = usePathname();

  const linkStyle = (href: string) => ({
    padding: "6px 10px",
    borderRadius: 6,
    background: isActive(path, href) ? "#111" : "#eee",
    color: isActive(path, href) ? "#fff" : "#000",
    textDecoration: "none",
    fontSize: 14,
  });

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      <Link href="/superadmin" style={linkStyle("/superadmin")}>
        Kontrollsenter
      </Link>
      <Link href="/superadmin/overview" style={linkStyle("/superadmin/overview")}>
        Driftsoversikt
      </Link>
      <Link href="/superadmin/daily-brief" style={linkStyle("/superadmin/daily-brief")}>
        Morgenoversikt
      </Link>
      <Link href="/superadmin/control-tower" style={linkStyle("/superadmin/control-tower")}>
        Kontrolltårn
      </Link>
      <Link href="/superadmin/global" style={linkStyle("/superadmin/global")}>
        Global
      </Link>
      <Link href="/superadmin/growth/social" style={linkStyle("/superadmin/growth/social")}>
        Vekst
      </Link>
      <Link href="/superadmin/pipeline" style={linkStyle("/superadmin/pipeline")}>
        Pipeline
      </Link>
      <Link href="/superadmin/investor" style={linkStyle("/superadmin/investor")}>
        Investor
      </Link>
      <Link href="/superadmin/cto" style={linkStyle("/superadmin/cto")}>
        AI CTO
      </Link>
      <Link href="/superadmin/sales" style={linkStyle("/superadmin/sales")}>
        Salg
      </Link>
      <Link href="/superadmin/sales-loop" style={linkStyle("/superadmin/sales-loop")}>
        Salgsloop
      </Link>
      <Link href="/superadmin/sales-agent" style={linkStyle("/superadmin/sales-agent")}>
        Salgsagent
      </Link>
      <Link href="/superadmin/operations" style={linkStyle("/superadmin/operations")}>
        Operasjoner
      </Link>
      <Link href="/superadmin/production-check" style={linkStyle("/superadmin/production-check")}>
        Produksjonssjekk
      </Link>
      <Link href="/superadmin/system-graph" style={linkStyle("/superadmin/system-graph")}>
        Systemgraf
      </Link>
      <Link href="/superadmin/strategy" style={linkStyle("/superadmin/strategy")}>
        AI-strategi
      </Link>
      <Link href="/superadmin/autonomy" style={linkStyle("/superadmin/autonomy")}>
        Autonomi
      </Link>
      <Link href="/superadmin/experiments" style={linkStyle("/superadmin/experiments")}>
        Eksperimenter
      </Link>
      <Link href="/superadmin/agreements" style={linkStyle("/superadmin/agreements")}>
        Avtaler
      </Link>
      <Link href="/superadmin/companies" style={linkStyle("/superadmin/companies")}>
        Firma
      </Link>
      <Link href="/superadmin/audit" style={linkStyle("/superadmin/audit")}>
        Revisjon
      </Link>
      <Link href="/superadmin/system" style={linkStyle("/superadmin/system")}>
        Systemhelse
      </Link>
    </div>
  );
}
