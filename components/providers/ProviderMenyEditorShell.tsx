"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import LocaleSwitcher from "@/components/nav/LocaleSwitcher";
import type { ProviderRole } from "@/lib/providers/types";

type NavLink = { href: string; label: string; adminOnly?: boolean };

const EDITOR_NAV: NavLink[] = [
  { href: "/leverandor/kunder", label: "Kunder" },
  { href: "/leverandor/registreringer", label: "Registreringer", adminOnly: true },
  { href: "/leverandor/meny", label: "Meny" },
  { href: "/leverandor/omrader", label: "Områder", adminOnly: true },
  { href: "/leverandor/faktura", label: "Faktura", adminOnly: true },
];

function roleShortLabel(role: ProviderRole | null): string {
  if (role === "provider_admin") return "Leverandør-admin";
  if (role === "provider_kitchen") return "Kjøkken";
  return "Leverandør";
}

type Props = {
  providerName: string;
  userRole: ProviderRole | null;
  providerAdmin?: boolean;
};

export default function ProviderMenyEditorShell({
  providerName,
  userRole,
  providerAdmin = false,
}: Props) {
  const pathname = usePathname() || "/leverandor/meny";
  const initials = providerName.slice(0, 2).toUpperCase();
  const nav = EDITOR_NAV.filter((item) => !item.adminOnly || providerAdmin);

  return (
    <header className="lp-editor-topbar" aria-label="Leverandør navigasjon">
      <div className="lp-editor-topbar__brand">
        <span className="lp-editor-topbar__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z" />
          </svg>
        </span>
        <span className="lp-editor-topbar__brand-text">
          Lunch<span className="lp-editor-topbar__brand-accent">portalen</span>
        </span>
      </div>

      <nav className="lp-editor-topbar__nav" aria-label="Hovedmeny">
        {nav.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/leverandor" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`lp-editor-topbar__nav-link${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <span className="lp-editor-topbar__spacer" />

      <div className="lp-editor-topbar__lang">
        <LocaleSwitcher className="lp-editor-topbar__locale" />
      </div>

      <div className="lp-editor-topbar__who">
        <span className="lp-editor-topbar__avatar" aria-hidden="true">{initials}</span>
        <div className="lp-editor-topbar__who-text">
          <b>{providerName}</b>
          <span>{roleShortLabel(userRole)}</span>
        </div>
      </div>
    </header>
  );
}
