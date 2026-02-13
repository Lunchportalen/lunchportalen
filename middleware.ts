// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Middleware goals (RC-safe):
 * - Never touch /api (handled server-side with route guards)
 * - Protect sensitive pages from anonymous access
 * - Preserve Supabase auth cookies (SSR)
 * - Add lightweight debug headers (x-lp-mw*)
 *
 * RC PERF LAW:
 * - DO NOT call supabase.auth.getUser() on public pages.
 * - Only auth-check for protected routes.
 */

function isBypassPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/api/") || // ✅ API handled by route guards
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/status" ||
    pathname.startsWith("/status/")
  );
}

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/kitchen")
  );
}

function isExplicitlyPublicProtectedSubpath(_pathname: string) {
  return false;
}

function buildNextParam(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return pathname + (qs ? `?${qs}` : "");
}

function mustEnv(name: string) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function extractRoleFromUser(user: any): string {
  const r1 = safeStr(user?.app_metadata?.role);
  if (r1) return r1;
  const r2 = safeStr(user?.user_metadata?.role);
  if (r2) return r2;
  const arr = user?.app_metadata?.roles ?? user?.user_metadata?.roles;
  if (Array.isArray(arr) && arr.length) return safeStr(arr[0]);
  return "";
}

function copyCookies(from: NextResponse, to: NextResponse) {
  try {
    const all = from.cookies.getAll();
    for (const c of all) to.cookies.set(c.name, c.value);
  } catch {}
}

function copyDebugHeaders(from: NextResponse, to: NextResponse) {
  for (const [k, v] of from.headers.entries()) {
    if (k.toLowerCase().startsWith("x-lp-mw")) to.headers.set(k, v);
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Prepare response early so cookie writes work
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-url", req.nextUrl.href);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-lp-mw", "1");

  // 1) Bypass assets/public endpoints
  if (isBypassPath(pathname)) {
    res.headers.set("x-lp-mw-bypass", "1");
    return res;
  }

  // 2) RC PERF: If route is NOT protected, do NOT touch Supabase at all
  const needsAuth = isProtectedPath(pathname) && !isExplicitlyPublicProtectedSubpath(pathname);
  if (!needsAuth) {
    res.headers.set("x-lp-mw-skip-auth", "1");
    return res;
  }

  // 3) Only now: Supabase SSR client + auth check
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anon) {
    // In RC: don't hard fail; just mark env missing.
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

  let user: any = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data?.user ?? null;
  } catch {
    user = null;
  }

  res.headers.set("x-lp-mw-user", user ? "1" : "0");

  // 4) If not logged in -> redirect to login with next
  if (!user) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.search = "";
    u.searchParams.set("next", buildNextParam(pathname, searchParams));

    const redir = NextResponse.redirect(u, { status: 303 });
    copyCookies(res, redir);
    copyDebugHeaders(res, redir);
    redir.headers.set("x-lp-mw-redirect", "login");
    return redir;
  }

  // 5) Superadmin hard gate (NO EXCEPTIONS)
  if (pathname.startsWith("/superadmin")) {
    const role = extractRoleFromUser(user);
    if (role) res.headers.set("x-lp-mw-role", role);

    if (role !== "superadmin") {
      const u = req.nextUrl.clone();
      u.pathname = "/admin";
      u.search = "";

      const redir = NextResponse.redirect(u, { status: 303 });
      copyCookies(res, redir);
      copyDebugHeaders(res, redir);
      redir.headers.set("x-lp-mw-superadmin-block", role ? "role" : "missing-role");
      return redir;
    }
  }

  // 6) allow
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
