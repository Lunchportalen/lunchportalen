// components/site/PublicHeader.tsx
"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

// Safe next target:
// - Avoid sending users back to /login or /status which can create loops.
// - Default to /week when already on auth/status routes.
function safeNextFromPath(pathname: string) {
  const p = safePath(pathname);
  if (p.startsWith("/login") || p.startsWith("/status") || p.startsWith("/auth")) return "/week";
  return p || "/week";
}

export function PublicAuthSlot({
  next,
  isLoggedIn = false,
}: {
  next?: string;
  isLoggedIn?: boolean;
}) {
  const pathname = safePath(usePathname());
  const targetNext = encodeURIComponent(next ?? safeNextFromPath(pathname));

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="hidden sm:inline-flex items-center rounded-full border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 text-xs text-[rgb(var(--lp-muted))] shadow-[var(--lp-shadow-sm)]">
        {isLoggedIn ? "Innlogget" : "Ikke innlogget"}
      </span>

      <Link
        href={`/login?next=${targetNext}`}
        className="inline-flex h-11 items-center justify-center rounded-[var(--lp-radius-btn)] border border-[rgba(var(--lp-border),0.9)] bg-white px-4 text-sm font-medium text-[rgb(var(--lp-text))] shadow-[var(--lp-shadow-sm)] hover:bg-black/5"
        aria-label="Til login"
        prefetch
      >
        Til login
      </Link>
    </div>
  );
}

export default function PublicHeader({
  nav,
  rightSlot,
}: {
  nav: NavItem[];
  rightSlot?: React.ReactNode;
}) {
  const pathname = safePath(usePathname());
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasNav = Array.isArray(nav) && nav.length > 0;

  return (
    <header className="lp-topbar border-b border-[rgb(var(--lp-border))] bg-white/90 supports-[backdrop-filter]:bg-white/75">
      <div className={cx("lp-container", "flex items-center justify-between gap-4 h-20 md:h-28")}>
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" aria-label="Gå til forsiden" className="inline-flex items-center focus:outline-none">
            <Image
              src="/brand/LP-logo-uten-bakgrunn.png"
              alt="Lunchportalen"
              width={900}
              height={320}
              className="lp-header-logo"
              priority
            />
          </Link>
        </div>

        {hasNav ? (
          <nav className="hidden md:flex items-center gap-2 text-sm" aria-label="Hovedmeny">
            {nav.map((item) => {
              const href = normalizeHref(item.href);
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx("lp-nav-item", active ? "lp-nav-item--active" : "hover:bg-black/5")}
                  prefetch
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="hidden md:block" />
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          {hasNav ? (
            <button
              type="button"
              className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-[var(--lp-radius-btn)] border border-[rgba(var(--lp-border),0.9)] bg-white shadow-[var(--lp-shadow-sm)]"
              aria-label={open ? "Lukk meny" : "Åpne meny"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="relative block h-4 w-5">
                <span
                  className="absolute left-0 top-0 h-[2px] w-5 rounded-full bg-[rgb(var(--lp-text))] transition"
                  style={{ transform: open ? "translateY(7px) rotate(45deg)" : "none" }}
                />
                <span
                  className="absolute left-0 top-[7px] h-[2px] w-5 rounded-full bg-[rgb(var(--lp-text))] transition"
                  style={{ opacity: open ? 0 : 1 }}
                />
                <span
                  className="absolute left-0 top-[14px] h-[2px] w-5 rounded-full bg-[rgb(var(--lp-text))] transition"
                  style={{ transform: open ? "translateY(-7px) rotate(-45deg)" : "none" }}
                />
              </span>
            </button>
          ) : null}

          {/* Optional right slot (no default auth/session UI). */}
          {rightSlot}
        </div>
      </div>

      {hasNav ? (
        <div className={cx("md:hidden", open ? "block" : "hidden")}>
          <div className="lp-container pb-3">
            <div className="rounded-2xl border border-[rgba(var(--lp-border),0.9)] bg-white/90 shadow-[var(--lp-shadow-card)] backdrop-blur">
              <nav className="flex flex-col p-2" aria-label="Mobilmeny">
                {nav.map((item) => {
                  const href = normalizeHref(item.href);
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cx("lp-nav-item", active ? "lp-nav-item--active" : "hover:bg-black/5")}
                      prefetch
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
