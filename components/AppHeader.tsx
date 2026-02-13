// components/AppHeader.tsx
import "server-only";

import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";

import LogoutButton from "@/components/auth/LogoutButton";
import { getSessionUser } from "@/lib/auth/getSessionUser";

type NavItem = { label: string; href: string };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isActive(current: string, href: string) {
  if (href === "/") return current === "/";
  return current === href || current.startsWith(href + "/");
}

/**
 * RC PERF LAW:
 * - Do NOT call getSessionUser() on public pages.
 * - Only call on protected areas.
 */
function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/week") ||
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/min-side")
  );
}

async function currentPath(): Promise<string> {
  // ✅ In your project, headers() is typed as Promise<ReadonlyHeaders>
  const h = await headers();
  return safeStr(h.get("x-pathname")) || "/";
}

export default async function AppHeader({
  areaLabel,
  nav,
  authMode = "auto",
}: {
  areaLabel: string;
  nav: NavItem[];
  /**
   * auto: only fetch session on protected paths
   * required: always fetch session (use sparingly)
   * none: never fetch session (always show not logged in)
   */
  authMode?: "auto" | "required" | "none";
}) {
  const pathname = await currentPath();

  // ✅ Fast path: avoid auth fetch on public pages
  const shouldFetchSession =
    authMode === "required" ? true : authMode === "none" ? false : isProtectedPath(pathname);

  let email: string | null = null;

  if (shouldFetchSession) {
    try {
      const session = await getSessionUser();
      email = session?.email ?? null;
    } catch {
      email = null;
    }
  }

  return (
    <header className="lp-topbar">
      <div className="lp-container lp-topbar-inner">
        {/* LEFT: Logo + area label */}
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" aria-label="Gå til forsiden" className="inline-flex items-center focus:outline-none">
            <Image
              src="/brand/LP-logo-uten-bakgrunn.png"
              alt="Lunchportalen"
              width={240}
              height={120}
              sizes="(max-width: 640px) 160px, 240px"
              className="h-14 md:h-[100px] w-auto max-h-[100px] object-contain"
              priority
            />
          </Link>

          <span className="hidden md:inline-block text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
            {areaLabel}
          </span>
        </div>

        {/* CENTER: Navigation (desktop) */}
        <nav className="lp-topbar-nav hidden md:flex items-center gap-2 text-sm" aria-label="Hovedmeny">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`lp-nav-item ${active ? "lp-nav-item--active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT: User / actions */}
        <div className="lp-topbar-slot">
          {email ? (
            <span className="lp-pill-email rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[rgb(var(--lp-text))] lp-wrap-anywhere">
              {email}
            </span>
          ) : (
            <span className="rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[rgb(var(--lp-text))]">
              Ikke innlogget
            </span>
          )}

          {email ? (
            <LogoutButton variant="ghost" />
          ) : (
            <Link href="/login" className="lp-btn lp-btn--ghost lp-btn--sm">
              Til login
            </Link>
          )}
        </div>
      </div>

      {/* MOBILE NAV (under header) */}
      {nav.length > 0 ? (
        <div className="md:hidden border-t border-[rgb(var(--lp-border))] bg-white/80 backdrop-blur">
          <div className="lp-container py-2 flex gap-2 overflow-x-auto">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`lp-nav-item whitespace-nowrap ${active ? "lp-nav-item--active" : ""}`}
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
