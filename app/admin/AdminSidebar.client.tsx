"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type IconName = "grid" | "sun" | "calendar" | "users" | "pin" | "document" | "chart";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS_BASE: NavGroup[] = [
  {
    label: "Drift",
    items: [
      { href: "/admin", label: "Oversikt", icon: "grid", exact: true },
      { href: "/admin/dagens-brukere", label: "Dagens drift", icon: "sun" },
      { href: "/admin/uke-bestillbarhet", label: "Uke og bestilling", icon: "calendar" },
    ],
  },
  {
    label: "Bedrift",
    items: [
      { href: "/admin/people", label: "Ansatte", icon: "users" },
      { href: "/admin/locations", label: "Lokasjoner", icon: "pin" },
      { href: "/admin/agreement", label: "Avtale og drift", icon: "document" },
    ],
  },
];

function buildNavGroups(companyId: string | null | undefined): NavGroup[] {
  const cid = String(companyId ?? "").trim();
  const innsiktItems: NavItem[] = [];
  if (cid) {
    innsiktItems.push({
      href: `/admin/company/${cid}/dashboard`,
      label: "Firmadashbord",
      icon: "document",
    });
  }
  innsiktItems.push({ href: "/admin/insights", label: "Økonomi", icon: "chart" });
  return [
    ...NAV_GROUPS_BASE,
    {
      label: "Innsikt",
      items: innsiktItems,
    },
  ];
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminIcon({ name }: { name: IconName }) {
  if (name === "grid") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
      </svg>
    );
  }
  if (name === "sun") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
      </svg>
    );
  }
  if (name === "calendar") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1z" />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19a3.5 3.5 0 0 0-3-3.46M17 5.4a2.5 2.5 0 0 1 0 4.2" />
      </svg>
    );
  }
  if (name === "pin") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }
  if (name === "document") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v5h5M8 13h8M8 17h6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19h16M6 16l4-4 3 3 5-7" />
      <path d="M18 8h-4M18 8v4" />
    </svg>
  );
}

export function AdminSidebarNav({ companyId }: { companyId?: string | null }) {
  const pathname = usePathname() || "/admin";
  const groups = buildNavGroups(companyId);

  return (
    <nav className="ds-admin-sidebar__nav" aria-label="Hovednavigasjon">
      {groups.map((group) => (
        <div className="ds-admin-sidebar__group" key={group.label}>
          <div className="ds-admin-sidebar__group-label">{group.label}</div>
          {group.items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                href={item.href}
                key={item.href}
                className={`ds-admin-sidebar__item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <AdminIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AdminSidebarUser({
  initials,
  userName,
}: {
  initials: string;
  userName: string;
}): ReactNode {
  return (
    <div className="ds-admin-sidebar__user">
      <div className="ds-admin-sidebar__avatar">{initials}</div>
      <div>
        <div className="ds-admin-sidebar__user-name">{userName}</div>
        <div className="ds-admin-sidebar__user-role">Firmaadmin</div>
      </div>
    </div>
  );
}

