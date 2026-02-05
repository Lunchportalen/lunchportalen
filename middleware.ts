// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isBypassPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/api/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/")
  );
}

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/driver")
  );
}

function buildNextParam(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return pathname + (qs ? `?${qs}` : "");
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-url", req.nextUrl.href);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  if (isBypassPath(pathname)) return res;

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

  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  res.headers.set("x-lp-mw", "1");
  res.headers.set("x-lp-mw-user", user ? "1" : "0");

  if (isProtectedPath(pathname)) {
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
