"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminIcon } from "./AdminSidebar.client";

const PRIMARY_ITEMS = [
  { href: "/admin", label: "Oversikt", icon: "grid" as const, exact: true },
  { href: "/admin/dagens-brukere", label: "I dag", icon: "sun" as const },
  { href: "/admin/people", label: "Ansatte", icon: "users" as const },
  { href: "/admin/insights", label: "Innsikt", icon: "chart" as const },
];

const MORE_ITEMS = [
  { href: "/admin/locations", label: "Lokasjoner" },
  { href: "/admin/agreement", label: "Avtale" },
  { href: "/admin/uke-bestillbarhet", label: "Uke og bestilling" },
  { href: "/api/admin/invoices/csv", label: "Faktura" },
];

function active(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  );
}

export default function AdminMobileNav() {
  const pathname = usePathname() || "/admin";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <nav className="ds-admin-mobile-nav" aria-label="Hovednavigasjon (mobil)">
        {PRIMARY_ITEMS.map((item) => {
          const isActive = active(pathname, item.href, item.exact);
          return (
            <Link
              href={item.href}
              key={item.href}
              className={`ds-admin-mobile-nav__item${isActive ? " is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <AdminIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className="ds-admin-mobile-nav__item"
          id="open-more-menu"
          aria-label="Åpne mer-meny"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <MoreIcon />
          <span>Mer</span>
        </button>
      </nav>

      <dialog className="ds-admin-more" open={open} onClick={(event) => event.target === event.currentTarget && setOpen(false)}>
        <div className="ds-admin-more__panel">
          <div className="ds-admin-more__head">
            <h2 className="ds-admin-more__title">Mer i admin</h2>
            <button type="button" className="ds-admin-more__close" aria-label="Lukk meny" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          <div className="ds-admin-more__list">
            {MORE_ITEMS.map((item) =>
              item.href.startsWith("/api/") ? (
                // eslint-disable-next-line @next/next/no-html-link-for-pages
                <a className="ds-admin-mobile-more-link" href={item.href} key={item.href}>
                  {item.label}
                  <span aria-hidden="true">↓</span>
                </a>
              ) : (
                <Link className="ds-admin-mobile-more-link" href={item.href} key={item.href} onClick={() => setOpen(false)}>
                  {item.label}
                  <span aria-hidden="true">→</span>
                </Link>
              ),
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
