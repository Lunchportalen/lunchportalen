// middleware.ts
// Next.js 15: Supabase session refresh runs here via `updateSession` (see `utils/supabase/proxy.ts`).
// Next.js 16+: Supabase docs recommend root `proxy.ts` with the same refresh pattern; migrate when upgrading.

import { NextResponse, type NextRequest } from "next/server";

import { isLocalDevAuthenticatedRequest } from "@/lib/auth/localDevBypassCookie";
import { updateSession } from "@/utils/supabase/proxy";

function isBypassPath(pathname: string) {
  const isApi = pathname.startsWith("/api/");
  const allowAuthApi =
    pathname === "/api/auth/post-login" || pathname === "/api/auth/logout" || pathname === "/api/auth/login";

  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
    (isApi && !allowAuthApi) ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/status" ||
    pathname.startsWith("/status/")
  );
}

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/saas") ||
    pathname.startsWith("/week") ||
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/backoffice") ||
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

function copyCookies(from: NextResponse, to: NextResponse) {
  try {
    const all = from.cookies.getAll();
    for (const raw of all) {
      const { name, value, ...opts } = raw as { name: string; value: string } & Record<string, unknown>;
      if (Object.keys(opts).length) to.cookies.set(name, value, opts as Parameters<typeof to.cookies.set>[2]);
      else to.cookies.set(name, value);
    }
  } catch {
    return;
  }
}

function copyDebugHeaders(from: NextResponse, to: NextResponse) {
  for (const [k, v] of from.headers.entries()) {
    if (k.toLowerCase().startsWith("x-lp-mw")) to.headers.set(k, v);
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-url", req.nextUrl.href);

  if (isBypassPath(pathname)) {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-lp-mw", "1");
    res.headers.set("x-lp-mw-bypass", "1");
    return res;
  }

  const { response: res, hasSupabaseSessionCookie } = await updateSession(req, requestHeaders);
  res.headers.set("x-lp-mw", "1");

  const needsAuth = isProtectedPath(pathname) && !isExplicitlyPublicProtectedSubpath(pathname);
  if (!needsAuth) {
    res.headers.set("x-lp-mw-skip-auth", "1");
    return res;
  }

  /**
   * Protected-route gate (must align with `getAuthContext()`):
   * - Normal: Supabase SSR auth-token jar after `updateSession`.
   * - Dev/test only: valid `lp_local_dev_auth` when `isLocalDevAuthBypassEnabled()` (see `localDevBypassCookie.ts`).
   */
  const localDevBypass = isLocalDevAuthenticatedRequest(req);
  const sessionOk = hasSupabaseSessionCookie || localDevBypass;
  res.headers.set("x-lp-mw-user", sessionOk ? "1" : "0");
  if (localDevBypass && !hasSupabaseSessionCookie) res.headers.set("x-lp-mw-dev-bypass", "1");

  if (!sessionOk) {
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

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
