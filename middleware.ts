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
 * NOTE:
 * - We do NOT enforce company.status/is_active here (that belongs to scope.ts + route guards),
 *   because middleware should stay minimal and avoid DB queries on every request.
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
    pathname.startsWith("/login/")
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

/**
 * Optional: these are allowed without login even if protected routes exist
 * (kept minimal to avoid surprises)
 */
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

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Prepare response early so cookie writes work
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-url", req.nextUrl.href);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // Always set middleware marker header for diagnostics
  res.headers.set("x-lp-mw", "1");

  if (isBypassPath(pathname)) {
    res.headers.set("x-lp-mw-bypass", "1");
    return res;
  }

  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anon) {
    // In RC: don't hard fail middleware; just mark env missing.
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

  // Auth check (cookie-based). Keep it fast; no DB queries here.
  let user: any = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data?.user ?? null;
  } catch {
    user = null;
  }

  res.headers.set("x-lp-mw-user", user ? "1" : "0");

  // Gate protected routes
  if (isProtectedPath(pathname) && !isExplicitlyPublicProtectedSubpath(pathname)) {
    if (!user) {
      const u = req.nextUrl.clone();
      u.pathname = "/login";
      u.search = "";
      u.searchParams.set("next", buildNextParam(pathname, searchParams));
      return NextResponse.redirect(u, { status: 303 });
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
