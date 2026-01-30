// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Helpers
========================================================= */
function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

// HARD e-post-fasit for systemkontoer
function roleByEmail(email: string | null | undefined): Role | null {
  const e = normEmail(email);
  if (e === "superadmin@lunchportalen.no") return "superadmin";
  if (e === "kjokken@lunchportalen.no") return "kitchen";
  if (e === "driver@lunchportalen.no") return "driver";
  return null;
}

function isSystemEmail(email: string | null | undefined) {
  return roleByEmail(email) !== null;
}

function normalizeRole(v: unknown): Role {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  return "employee";
}

/**
 * ✅ Rolle-fasit UTEN DB:
 * 1) system-e-post
 * 2) app_metadata.role (ikke klient-skrivbar)
 * 3) user_metadata.role (fallback)
 */
function computeRoleNoDb(user: any): Role {
  const emailRole = roleByEmail(user?.email);
  if (emailRole) return emailRole;

  const appRole = normalizeRole(user?.app_metadata?.role);
  if (appRole !== "employee") return appRole;

  const metaRole = normalizeRole(user?.user_metadata?.role);
  return metaRole;
}

function homeForRole(role: Role): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  if (role === "company_admin") return "/admin";
  return "/week";
}

function isBypassPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/api/") // ✅ ALLE API-ruter bypasses
  );
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/registrering" ||
    pathname.startsWith("/registrering/") ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/")
  );
}

function isProtectedPath(pathname: string) {
  return (
    pathname === "/week" ||
    pathname.startsWith("/week/") ||
    pathname === "/min-side" ||
    pathname.startsWith("/min-side/") ||
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/superadmin" ||
    pathname.startsWith("/superadmin/") ||
    pathname === "/kitchen" ||
    pathname.startsWith("/kitchen/") ||
    pathname === "/driver" ||
    pathname.startsWith("/driver/")
  );
}

/**
 * Stram fasit:
 * - superadmin: kan overalt (aldri blokkeres)
 * - kitchen: kun /kitchen
 * - driver: kun /driver
 * - company_admin: /admin + ansatt-områder (/week,/orders,/min-side)
 * - employee: /week,/orders,/min-side
 */
function requiredRolesForPath(pathname: string): Role[] | null {
  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) return ["superadmin"];

  if (pathname === "/kitchen" || pathname.startsWith("/kitchen/")) return ["kitchen", "superadmin"];
  if (pathname === "/driver" || pathname.startsWith("/driver/")) return ["driver", "superadmin"];

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return ["company_admin", "superadmin"];

  if (
    pathname === "/week" ||
    pathname.startsWith("/week/") ||
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname === "/min-side" ||
    pathname.startsWith("/min-side/")
  ) {
    // ✅ company_admin skal også kunne bestille/avbestille
    return ["employee", "company_admin", "superadmin"];
  }

  return null;
}

function buildNextParam(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return pathname + (qs ? `?${qs}` : "");
}

function safeNextPath(requestedNext: string | null): string | null {
  if (!requestedNext) return null;
  const s = String(requestedNext).trim();
  if (!s) return null;

  if (s.startsWith("http://") || s.startsWith("https://")) {
    try {
      const u = new URL(s);
      return u.pathname + (u.search || "");
    } catch {
      return null;
    }
  }

  if (!s.startsWith("/")) return null;
  if (s.startsWith("//")) return null;

  // blokker auth-sider som next
  if (
    s === "/login" ||
    s.startsWith("/login/") ||
    s === "/register" ||
    s.startsWith("/register/") ||
    s === "/registrering" ||
    s.startsWith("/registrering/") ||
    s === "/forgot-password" ||
    s.startsWith("/forgot-password/")
  ) {
    return null;
  }

  return s;
}

/**
 * Systemkontoer ignorerer alltid ?next
 * + next må være innenfor riktig rolleområde, ellers home
 */
function pickDestination(user: any, requestedNextRaw: string | null) {
  const role = computeRoleNoDb(user);
  const home = homeForRole(role);

  // systemkontoer: tving home
  if (isSystemEmail(user?.email)) return home;

  const requestedNext = safeNextPath(requestedNextRaw);
  if (!requestedNext) return home;

  const nextPathname = requestedNext.split("?")[0] || requestedNext;
  const required = requiredRolesForPath(nextPathname);
  if (required && !required.includes(role)) return home;

  return requestedNext;
}

/* =========================================================
   ✅ Cookie-safe redirects
========================================================= */
function withCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, c);
  }
  return to;
}

function redirectTo(req: NextRequest, res: NextResponse, dest: string) {
  const url = req.nextUrl.clone();
  const [p, q] = String(dest).split("?");
  url.pathname = p || "/";
  url.search = q ? `?${q}` : "";
  return withCookies(res, NextResponse.redirect(url, { status: 303 }));
}

/* =========================================================
   Middleware
========================================================= */
export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (isBypassPath(pathname)) return NextResponse.next();

  // ✅ prefer-const fix
  const res = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    res.headers.set("x-lp-mw", "1");
    res.headers.set("x-lp-mw-env", "missing");
    return res;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  // refresh session
  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  res.headers.set("x-lp-mw", "1");
  res.headers.set("x-lp-mw-user", user ? "1" : "0");

  /* =========================
     Public paths
  ========================= */
  if (isPublicPath(pathname)) {
    if (!user) return res;

    const role = computeRoleNoDb(user);

    // / -> home
    if (pathname === "/") return redirectTo(req, res, homeForRole(role));

    // /login -> dest (next hvis lovlig)
    if (pathname === "/login" || pathname.startsWith("/login/")) {
      const dest = pickDestination(user, searchParams.get("next"));
      return redirectTo(req, res, dest);
    }

    // onboarding/register/registrering: innlogget → home
    if (
      pathname === "/onboarding" ||
      pathname.startsWith("/onboarding/") ||
      pathname === "/register" ||
      pathname.startsWith("/register/") ||
      pathname === "/registrering" ||
      pathname.startsWith("/registrering/")
    ) {
      return redirectTo(req, res, homeForRole(role));
    }

    return res;
  }

  /* =========================
     Protected paths
  ========================= */
  if (isProtectedPath(pathname)) {
    if (!user) {
      const u = req.nextUrl.clone();
      u.pathname = "/login";
      u.search = "";
      u.searchParams.set("next", buildNextParam(pathname, searchParams));
      return withCookies(res, NextResponse.redirect(u, { status: 303 }));
    }

    const role = computeRoleNoDb(user);

    // ✅ Superadmin påvirkes aldri: kan overalt
    if (role === "superadmin") return res;

    // Systemkontoer (kitchen/driver): alltid til sitt område (ignorer alt)
    const emailRole = roleByEmail(user.email);
    if (emailRole && emailRole !== "superadmin") {
      const home = homeForRole(emailRole);
      if (!(pathname === home || pathname.startsWith(home + "/"))) {
        return redirectTo(req, res, home);
      }
      return res;
    }

    // Streng gate: feil område -> home
    const required = requiredRolesForPath(pathname);
    if (required && !required.includes(role)) {
      return redirectTo(req, res, homeForRole(role));
    }

    return res;
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
