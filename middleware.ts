// middleware.ts
// Next.js 15: Supabase session refresh runs here via `updateSession` (see `utils/supabase/proxy.ts`).
// Next.js 16+: Supabase docs recommend root `proxy.ts` with the same refresh pattern; migrate when upgrading.

import { NextResponse, type NextRequest } from "next/server";

import { isLocalDevAuthenticatedRequest } from "@/lib/auth/localDevBypassCookie";
import { isApiAuthAllowlisted } from "@/lib/server/auth/apiAllowlist";
import { updateSession } from "@/utils/supabase/proxy";

function isBypassPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
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
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/leverandor")
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

function apiUnauthorizedResponse(rid: string): NextResponse {
  return NextResponse.json(
    { ok: false, rid, error: "UNAUTHORIZED", message: "Ikke innlogget.", status: 401 },
    {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-lp-mw-api-auth": "401",
      },
    },
  );
}

function makeRid(prefix = "mw"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  /**
   * Umbraco backoffice under `/umbraco` is proxied via `next.config.ts` rewrites to `UMBRACO_CMS_ORIGIN`
   * (or `UMBRACO_DELIVERY_BASE_URL` origin). Do not run Supabase session refresh here — avoids interfering
   * with Umbraco cookies and reduces accidental coupling to app auth.
   */
  if (pathname === "/umbraco" || pathname.startsWith("/umbraco/")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", pathname);
    requestHeaders.set("x-url", req.nextUrl.href);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-lp-mw", "1");
    res.headers.set("x-lp-mw-bypass", "1");
    return res;
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-url", req.nextUrl.href);

  /**
   * API auth: explicit allowlist only — all other /api/* require session (fail-closed 401 JSON).
   * Route files must implement their own cron/webhook/anon/api-key gates when allowlisted.
   */
  if (pathname.startsWith("/api/")) {
    if (isApiAuthAllowlisted(pathname)) {
      const res = NextResponse.next({ request: { headers: requestHeaders } });
      res.headers.set("x-lp-mw", "1");
      res.headers.set("x-lp-mw-bypass", "allowlist");
      return res;
    }

    const { response: res, hasSupabaseSessionCookie } = await updateSession(req, requestHeaders);
    res.headers.set("x-lp-mw", "1");

    const localDevBypass = isLocalDevAuthenticatedRequest(req);
    const sessionOk = hasSupabaseSessionCookie || localDevBypass;
    res.headers.set("x-lp-mw-user", sessionOk ? "1" : "0");
    if (localDevBypass && !hasSupabaseSessionCookie) res.headers.set("x-lp-mw-dev-bypass", "1");

    if (!sessionOk) {
      const denied = apiUnauthorizedResponse(makeRid());
      copyCookies(res, denied);
      copyDebugHeaders(res, denied);
      return denied;
    }

    return res;
  }

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
