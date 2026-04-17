"use client";

import Link from "next/link";

export type BackofficeWorkspaceViewTabItem = {
  id?: string;
  href?: string;
  label: string;
  /** Når true kreves eksakt path-match (uten understi). */
  exact?: boolean;
  active?: boolean;
  description?: string;
  onClick?: () => void;
};

type Props = {
  items: readonly BackofficeWorkspaceViewTabItem[];
  pathname?: string;
  /** Tilgjengelig overskrift for region */
  ariaLabel: string;
  surface?: "default" | "subtle";
};

function activeFor(pathname: string, href: string, exact?: boolean): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  const h = href.replace(/\/+$/, "") || "/";
  if (exact) return p === h;
  return p === h || p.startsWith(`${h}/`);
}

/**
 * U31 — Workspace views (Umbraco content apps / faner) — kun navigasjon, ingen ny motor.
 */
export function BackofficeWorkspaceViewTabs({
  items,
  pathname,
  ariaLabel,
  surface = "default",
}: Props) {
  const navClassName =
    surface === "subtle"
      ? "flex flex-wrap gap-1 rounded-xl border border-[rgb(var(--lp-border))]/60 bg-[rgb(var(--lp-card))]/35 p-1"
      : "flex flex-wrap gap-1 rounded-xl border border-[rgb(var(--lp-border))] bg-white/90 p-1 shadow-sm";
  return (
    <nav
      className={navClassName}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active =
          item.active ?? (pathname && item.href ? activeFor(pathname, item.href, item.exact) : false);
        const activeClassName =
          surface === "subtle"
            ? "bg-white text-[rgb(var(--lp-text))] shadow-sm ring-1 ring-pink-500/20"
            : "bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-text))] shadow-sm ring-1 ring-pink-500/25";
        const idleClassName =
          surface === "subtle"
            ? "text-[rgb(var(--lp-muted))] hover:bg-white/80 hover:text-[rgb(var(--lp-text))]"
            : "text-[rgb(var(--lp-muted))] hover:bg-slate-50 hover:text-[rgb(var(--lp-text))]";
        const className = `min-h-10 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active ? activeClassName : idleClassName
        }`;
        const title = item.description ?? item.label;

        if (item.onClick || !item.href) {
          return (
            <button
              key={item.id ?? item.label}
              type="button"
              data-lp-workspace-view-tab={item.id}
              onClick={item.onClick}
              className={className}
              aria-pressed={active}
              title={title}
            >
              {item.label}
            </button>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={className}
            title={title}
            data-lp-workspace-view-tab={item.id}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
