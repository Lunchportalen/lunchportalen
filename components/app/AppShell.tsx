// components/app/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useMemo } from "react";

type NavItem = { href: string; label: string };

export function AppShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  const nav: NavItem[] = useMemo(
    () => [
      { href: "/admin", label: "Dashboard" },
      { href: "/week", label: "Ukesplan" },
      { href: "/orders", label: "Bestillinger" },
      { href: "/admin/users", label: "Ansatte" },
      { href: "/admin/agreement", label: "Avtale" },
      { href: "/admin/billing", label: "Faktura" },
      { href: "/kitchen", label: "Kjøkken" },
      { href: "/superadmin", label: "Superadmin" },
    ],
    []
  );

  return (
    <div className="lp-page">
      {/* Topbar */}
      <header className="lp-topbar">
        <div className="lp-container lp-topbar-inner">
          {/* Brand */}
          <div className="lp-brand">
            <span className="lp-logo-mark" aria-hidden />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <strong style={{ fontSize: 14 }}>Lunchportalen</strong>
              <span className="lp-text-muted" style={{ fontSize: 12 }}>
                Admin
              </span>
            </div>
          </div>

          {/* Nav */}
          <nav className="lp-topbar-nav" aria-label="Hovedmeny">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {nav.map((it) => {
                const isActive =
                  pathname === it.href || (it.href !== "/admin" && pathname?.startsWith(it.href + "/")) || false;

                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`lp-nav-item ${isActive ? "lp-nav-item--active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    style={{ fontSize: 13, fontWeight: 650 }}
                  >
                    {it.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Right slot */}
          <div className="lp-topbar-slot">{right ?? null}</div>
        </div>
      </header>

      {/* Main */}
      <main className="lp-main">
        <div className="lp-container">
          {/* Command header */}
          <section className="lp-card lp-card--elevated" style={{ marginBottom: 16 }}>
            <div className="lp-card-content" style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 360px", minWidth: 0 }}>
                <div className="lp-text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  Oversikt
                </div>
                <h1 className="lp-h1" style={{ margin: 0 }}>
                  {title}
                </h1>
                {subtitle ? (
                  <div className="lp-muted" style={{ marginTop: 10 }}>
                    {subtitle}
                  </div>
                ) : null}
              </div>

              {right ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{right}</div>
              ) : null}
            </div>
          </section>

          {children}
        </div>
      </main>
    </div>
  );
}
