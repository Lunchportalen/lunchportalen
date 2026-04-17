"use client";

// STATUS: ARCHIVE

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import LogoutButton from "@/components/auth/LogoutButton";

export type NavItem = { label: string; href: string };

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function safePath(p: string | null | undefined) {
  const v = (p ?? "/").trim();
  if (!v) return "/";
  const q = v.indexOf("?");
  const h = v.indexOf("#");
  const cut = Math.min(q === -1 ? v.length : q, h === -1 ? v.length : h);
  const out = v.slice(0, cut);
  return out || "/";
}

function normalizeHref(href: string) {
  const v = String(href ?? "/").trim();
  if (!v) return "/";
  if (!v.startsWith("/")) return `/${v}`;
  return v;
}

function isActive(currentRaw: string, hrefRaw: string) {
  const current = safePath(currentRaw);
  const href = normalizeHref(hrefRaw);

  if (href === "/") return current === "/";
  return current === href || current.startsWith(href + "/");
}

export default function AdminHeader({
  nav,
  title,
}: {
  nav: NavItem[];
  title?: string;
}) {
  const pathname = safePath(usePathname());

  return (
    <header className="w-full border-b border-[rgb(var(--lp-border))] lp-glass-nav">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-3">
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-extrabold tracking-tight text-[rgb(var(--lp-text))]">
            {title ?? "Admin"}
          </span>
        </div>

        {/* NAV */}
        <nav className="flex items-center gap-2" aria-label="Admin navigasjon">
          {nav?.map((item) => {
            const href = normalizeHref(item.href);
            const active = isActive(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "lp-motion-btn rounded-full px-3 py-1.5 text-sm font-semibold",
                  active
                    ? "ring-2 ring-[var(--lp-hotpink)] shadow-[0_0_18px_rgba(var(--lp-neon-rgb),0.45)]"
                    : "border border-[rgb(var(--lp-border))] hover:bg-black/5"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          <LogoutButton variant="ghost" className="lp-btn lp-btn--ghost lp-btn--sm" />
        </div>
      </div>
    </header>
  );
}
