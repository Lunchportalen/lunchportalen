// STATUS: ARCHIVE

// components/site/AdminHeaderClient.tsx
"use client";

import React from "react";
import Image from "next/image";
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

export default function AdminHeaderClient({
  nav,
  email,
  title,
}: {
  nav: NavItem[];
  email: string | null;
  title: string;
}) {
  const pathname = safePath(usePathname());
  const emailLabel = (email ?? "").trim() || null;

  return (
    <header className="lp-topbar border-b border-[rgb(var(--lp-border))] bg-white/90 supports-[backdrop-filter]:bg-white/75">
      <div className={cx("lp-container", "flex items-center justify-between gap-4 h-24 md:h-28")}>
        {/* LEFT: Logo + admin title */}
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" aria-label="Gå til forsiden" className="inline-flex items-center focus:outline-none">
            <Image
              src="/brand/LP-logo-uten-bakgrunn.png"
              alt="Lunchportalen"
              width={900}
              height={320}
              sizes="(max-width: 640px) 260px, (max-width: 1024px) 420px, 520px"
              className="h-20 md:h-24 lg:h-28 w-auto object-contain"
              priority
            />
          </Link>

          <span className="hidden lg:inline-flex items-center rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1 text-xs font-extrabold text-[rgb(var(--lp-text))]">
            {title}
          </span>
        </div>

        {/* CENTER (desktop nav) */}
        {nav?.length ? (
          <nav className="hidden md:flex items-center gap-2 text-sm" aria-label="Administrasjon">
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

        {/* RIGHT */}
        <div className="flex items-center gap-2 sm:gap-3">
          {emailLabel ? (
            <>
              <span
                className="rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[rgb(var(--lp-text))] max-w-56 sm:max-w-64 truncate"
                title={emailLabel}
              >
                {emailLabel}
              </span>
              <LogoutButton variant="ghost" />
            </>
          ) : (
            <Link href="/login" className="lp-btn lp-btn-ghost lp-btn--sm">
              Til login
            </Link>
          )}
        </div>
      </div>

      {/* MOBILE NAV */}
      {nav?.length ? (
        <div className="md:hidden border-t border-[rgb(var(--lp-border))] bg-white/90">
          <div className="lp-container py-2 flex gap-2 overflow-x-auto">
            {nav.map((item) => {
              const href = normalizeHref(item.href);
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx("lp-nav-item whitespace-nowrap", active ? "lp-nav-item--active" : "hover:bg-black/5")}
                  prefetch
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
