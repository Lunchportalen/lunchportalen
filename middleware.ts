// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
    pathname.startsWith("/week") ||
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

function copyCookies(from: NextResponse, to: NextResponse) {
  try {
    const all = from.cookies.getAll();
    for (const c of all) to.cookies.set(c.name, c.value);
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

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-lp-mw", "1");

  if (isBypassPath(pathname)) {
    res.headers.set("x-lp-mw-bypass", "1");
    return res;
  }

  const needsAuth = isProtectedPath(pathname) && !isExplicitlyPublicProtectedSubpath(pathname);
  if (!needsAuth) {
    res.headers.set("x-lp-mw-skip-auth", "1");
    return res;
  }

  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anon) {
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

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
