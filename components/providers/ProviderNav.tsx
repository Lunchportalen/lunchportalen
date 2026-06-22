"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { LogoutClientButton } from "@/components/auth/LogoutClient";
import type { ProviderRole } from "@/lib/providers/types";

type IconName = "grid" | "users" | "orders" | "document" | "pin" | "settings" | "billing" | "logout";

type NavLabelKey =
  | "dashboard"
  | "orders"
  | "customers"
  | "registrations"
  | "menu"
  | "areas"
  | "invoices"
  | "settings"
  | "logout"
  | "more";

type NavItem = {
  href?: string;
  labelKey: NavLabelKey;
  icon: IconName;
  exact?: boolean;
  disabled?: boolean;
  adminOnly?: boolean;
  action?: "logout";
};

const NAV_ITEMS_BASE: NavItem[] = [
  { href: "/leverandor", labelKey: "dashboard", icon: "grid", exact: true },
  { href: "/leverandor/ordrer", labelKey: "orders", icon: "orders" },
  { href: "/leverandor/kunder", labelKey: "customers", icon: "users" },
  { href: "/leverandor/registreringer", labelKey: "registrations", icon: "document" },
  { href: "/leverandor/meny", labelKey: "menu", icon: "document" },
  { href: "/leverandor/omrader", labelKey: "areas", icon: "pin", adminOnly: true },
  { href: "/leverandor/faktura", labelKey: "invoices", icon: "billing", adminOnly: true },
  { href: "/leverandor/innstillinger", labelKey: "settings", icon: "settings" },
  { labelKey: "logout", icon: "logout", action: "logout" },
];

function navItemsForRole(kitchenOnly: boolean, providerAdmin: boolean): NavItem[] {
  if (!kitchenOnly) {
    return NAV_ITEMS_BASE.filter((item) => {
      if (item.href === "/leverandor/registreringer" && !providerAdmin) return false;
      if (item.adminOnly && !providerAdmin) return false;
      return true;
    });
  }
  return [
    { href: "/leverandor/ordrer", labelKey: "orders", icon: "orders", exact: true },
    { href: "/leverandor/kunder", labelKey: "customers", icon: "users" },
    { href: "/leverandor/meny", labelKey: "menu", icon: "document" },
    { href: "/leverandor/innstillinger", labelKey: "settings", icon: "settings" },
    { labelKey: "logout", icon: "logout", action: "logout" },
  ];
}

function ProviderIcon({ name }: { name: IconName }) {
  if (name === "grid") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
      </svg>
    );
  }
  if (name === "orders") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 19a4 4 0 0 0-8 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
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
  if (name === "pin") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }
  if (name === "settings") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M19.4 15a7.9 7.9 0 0 0 .1-1l2-1.5-2-3.5-2.3.7a8 8 0 0 0-1.7-1L15 4h-6l-.5 2.7a8 8 0 0 0-1.7 1L4.5 7 2.5 10.5 4.5 12a8 8 0 0 0 0 2l-2 1.5 2 3.5 2.3-.7a8 8 0 0 0 1.7 1L9 20h6l.5-2.7a8 8 0 0 0 1.7-1l2.3.7 2-3.5-2-1.5a7.9 7.9 0 0 0-.1-1Z" />
      </svg>
    );
  }
  if (name === "billing") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

function isActive(pathname: string, item: NavItem) {
  if (!item.href) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  pathname,
  label,
  logoutLabel,
  comingSoonLabel,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  label: string;
  logoutLabel: string;
  comingSoonLabel: string;
  onNavigate?: () => void;
}) {
  const active = item.href ? isActive(pathname, item) : false;
  const className = `ds-admin-sidebar__item${active ? " is-active" : ""}${item.disabled ? " ds-provider-nav__item is-disabled" : ""}`;

  if (item.action === "logout") {
    return <LogoutClientButton className={className} aria-label={logoutLabel} title={logoutLabel} />;
  }

  if (item.disabled || !item.href) {
    return (
      <span className={className} aria-disabled="true">
        <ProviderIcon name={item.icon} />
        <span>
          {label}
          <span className="ds-provider-activity__meta"> {comingSoonLabel}</span>
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={className}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <ProviderIcon name={item.icon} />
      <span>{label}</span>
    </Link>
  );
}

function BrandBlock({
  providerName,
  logoUrl,
  accentColor,
  userRole,
  roleLabel,
}: {
  providerName: string;
  logoUrl: string | null;
  accentColor: string | null;
  userRole: ProviderRole | null;
  roleLabel: string;
}) {
  return (
    <div className="ds-admin-sidebar__brand">
      <div
        className={`ds-admin-sidebar__mark ds-provider-nav__mark${logoUrl ? " ds-provider-nav__mark--logo" : ""}`}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" width={40} height={40} />
        ) : (
          <span aria-hidden="true">{providerName.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div>
        <div className="ds-admin-sidebar__name">{providerName}</div>
        {accentColor ? (
          <span className="ds-provider-nav__accent" style={{ background: accentColor }} aria-hidden="true" />
        ) : null}
        <div className="ds-admin-sidebar__sub">{roleLabel}</div>
      </div>
    </div>
  );
}

function SidebarNav({
  pathname,
  items,
  labelForItem,
  logoutLabel,
  comingSoonLabel,
  onNavigate,
}: {
  pathname: string;
  items: NavItem[];
  labelForItem: (item: NavItem) => string;
  logoutLabel: string;
  comingSoonLabel: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="ds-admin-sidebar__nav" aria-label="Leverandør">
      {items.map((item) => (
        <NavLink
          key={item.labelKey}
          item={item}
          pathname={pathname}
          label={labelForItem(item)}
          logoutLabel={logoutLabel}
          comingSoonLabel={comingSoonLabel}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

export type ProviderNavProps = {
  providerName: string;
  logoUrl: string | null;
  /** Validated accent color (server truth via safeBrandAccent) — small details only. */
  accentColor?: string | null;
  /** Accepted for API stability; not rendered (no technical identity in provider UI). */
  userEmail?: string | null;
  userRole: ProviderRole | null;
  /** Kitchen-only members: Ordrer as home, no admin dashboard link. */
  kitchenOnly?: boolean;
  /** Show Registreringer queue (provider_admin only). */
  providerAdmin?: boolean;
};

export default function ProviderNav({
  providerName,
  logoUrl,
  accentColor = null,
  userRole,
  kitchenOnly = false,
  providerAdmin = false,
}: ProviderNavProps) {
  const pathname = usePathname() || "/leverandor";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const t = useTranslations("provider.nav");

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const navItems = navItemsForRole(kitchenOnly, providerAdmin);
  const labelForItem = (item: NavItem) => t(item.labelKey);
  const roleLabel =
    userRole === "provider_admin" ? t("roleAdmin") : userRole === "provider_kitchen" ? t("roleKitchen") : t("roleDefault");
  const logoutLabel = t("logout");
  const comingSoonLabel = t("comingSoon");

  const mobilePrimary: NavItem[] = kitchenOnly
    ? [navItems[0], navItems[1], navItems[2], { labelKey: "more", icon: "settings", href: "/leverandor/innstillinger" }]
    : [navItems[0], navItems[1], navItems[2], { labelKey: "more", icon: "settings", href: "/leverandor/innstillinger" }];

  return (
    <>
      <aside className="ds-admin-sidebar" aria-label="Leverandør (desktop)">
        <BrandBlock
          providerName={providerName}
          logoUrl={logoUrl}
          accentColor={accentColor}
          userRole={userRole}
          roleLabel={roleLabel}
        />
        <SidebarNav
          pathname={pathname}
          items={navItems}
          labelForItem={labelForItem}
          logoutLabel={logoutLabel}
          comingSoonLabel={comingSoonLabel}
        />
      </aside>

      <div className="ds-provider-topbar ds-provider-topbar--mobile-only">
        <button
          type="button"
          className="ds-provider-menu-toggle"
          aria-label={t("openMenu")}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          {t("menu")}
        </button>
      </div>

      {drawerOpen ? (
        <>
          <button
            type="button"
            className="ds-provider-drawer-backdrop"
            aria-label={t("closeMenu")}
            onClick={() => setDrawerOpen(false)}
          />
          <div className={`ds-provider-drawer is-open`} role="dialog" aria-modal="true" aria-label={t("providerMenu")}>
            <BrandBlock
              providerName={providerName}
              logoUrl={logoUrl}
              accentColor={accentColor}
              userRole={userRole}
              roleLabel={roleLabel}
            />
            <SidebarNav
              pathname={pathname}
              items={navItems}
              labelForItem={labelForItem}
              logoutLabel={logoutLabel}
              comingSoonLabel={comingSoonLabel}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </>
      ) : null}

      <nav className="ds-admin-mobile-nav" aria-label="Hovednavigasjon (mobil)">
        {mobilePrimary.map((item) => {
          if (!item.href) return null;
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`ds-admin-mobile-nav__item${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <ProviderIcon name={item.icon} />
              <span>{labelForItem(item)}</span>
            </Link>
          );
        })}
        <LogoutClientButton className="ds-admin-mobile-nav__item" aria-label={logoutLabel} title={logoutLabel} />
      </nav>
    </>
  );
}
