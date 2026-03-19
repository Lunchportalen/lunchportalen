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

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function isActive(current: string, href: string) {
  if (href === "/") return current === "/";
  return current === href || current.startsWith(href + "/");
}

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
  const h = await headers();
  const p = safeStr(h.get("x-pathname")) || "/";
  // strip query/hash if a proxy ever injects it
  return p.split("?")[0].split("#")[0] || "/";
}

function formatEmail(email: string | null) {
  const e = safeStr(email);
  if (!e) return null;
  return e;
}

function areaLabelForPath(pathname: string): string | null {
  if (!pathname) return null;
  if (pathname.startsWith("/superadmin")) return "Superadmin";
  if (pathname.startsWith("/admin")) return "Admin";
  if (pathname.startsWith("/kitchen") || pathname.startsWith("/kjokken")) return "Kjøkken";
  if (pathname.startsWith("/driver")) return "Sjåfør";
  if (pathname.startsWith("/system")) return "System";
  if (pathname === "/" || pathname === "/hvordan") return "Markedsføring";
  if (pathname.startsWith("/lunsj-") || pathname.startsWith("/lunsjordning") || pathname.startsWith("/alternativ-"))
    return "SXO";
  return null;
}

export default async function AppHeader({
  nav,
  authMode = "auto",
  containerMode = "container",
  areaLabel,
}: {
  nav: NavItem[];
  authMode?: "auto" | "required" | "none";
  containerMode?: "container" | "full";
  /** Optional: shown subtly on desktop (overrides auto label) */
  areaLabel?: string;
}) {
  const pathname = await currentPath();

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

  const emailLabel = formatEmail(email);
  const computedArea = areaLabel ?? areaLabelForPath(pathname);

  // ✅ Admin/superadmin can render full-width with enterprise padding
  const innerClass = containerMode === "full" ? "w-full px-5 sm:px-6 lg:px-10" : "lp-container";

  return (
    <header
      className="lp-topbar border-b border-[rgb(var(--lp-border))] lp-glass-nav"
      role="banner"
    >
      {/* =====================================================
          TOP ROW
          - Left: Logo (+ optional area label)
          - Center: Desktop nav
          - Right: User chip + logout/login
      ====================================================== */}
      <div className={cx(innerClass, "flex items-center justify-between gap-4 h-20 md:h-24")}>
        {/* LEFT */}
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Gå til forsiden" className="inline-flex items-center focus:outline-none">
            <Image
              src="/brand/LP-logo-uten-bakgrunn.png"
              alt="Lunchportalen"
              width={320}
              height={120}
              sizes="(max-width: 640px) 180px, 320px"
              className="h-12 md:h-16 w-auto object-contain"
              priority
            />
          </Link>

          {/* Optional subtle area label (desktop only) */}
          {computedArea ? (
            <span className="hidden lg:inline-flex items-center rounded-full border border-[rgb(var(--lp-border))] bg-white/60 px-3 py-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">
              {computedArea}
            </span>
          ) : null}
        </div>

        {/* CENTER (desktop nav) */}
        {nav.length > 0 ? (
          <nav className="hidden md:flex items-center gap-2 text-sm" aria-label="Hovedmeny">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "lp-nav-item",
                    active ? "lp-nav-item--active lp-neon-glow-hover" : "hover:bg-black/5"
                  )}
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

              {/* LogoutButton må håndtere variant="ghost" (som du bruker) */}
              <LogoutButton variant="ghost" />
            </>
          ) : (
            <>
              <span className="hidden sm:inline-flex rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[rgb(var(--lp-text))]">
                Ikke innlogget
              </span>
              <Link href="/login" className="lp-btn lp-btn--ghost lp-btn--sm">
                Til login
              </Link>
            </>
          )}
        </div>
      </div>

      {/* =====================================================
          MOBILE NAV ROW
          - No JS / no dropdown bugs
          - Horizontal scroll (stable)
          - Active shows neon ring
      ====================================================== */}
      {nav.length > 0 ? (
        <div className="md:hidden border-t border-[rgb(var(--lp-border))] lp-glass-nav">
          <div className={cx(innerClass, "py-2 flex gap-2 overflow-x-auto")}>
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "lp-nav-item whitespace-nowrap",
                    active ? "lp-nav-item--active lp-neon-glow-hover" : "hover:bg-black/5"
                  )}
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
