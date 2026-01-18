// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "active" | "paused" | "closed";

/* =========================================================
   Path rules
========================================================= */
function isBypassPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/api/cron/") // cron styres av secret, ikke session
  );
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/") ||
    pathname.startsWith("/status") // /status?state=paused|closed
  );
}

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/week") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/menus") || // ✅ superadmin menus/week
    pathname.startsWith("/api") // API er også beskyttet (med unntak over)
  );
}

// Hvilke roller får tilgang hvor (Avensia-nivå: stramt og tydelig)
function requiredRolesForPath(pathname: string): Role[] | null {
  // Superadmin-område
  if (pathname.startsWith("/admin/superadmin")) return ["superadmin"];

  // Meny-admin (Sanity/publishing UI)
  if (pathname.startsWith("/menus")) return ["superadmin"];

  // Admin (kunde-admin + superadmin)
  if (pathname.startsWith("/admin")) return ["company_admin", "superadmin"];

  // Kjøkken
  if (pathname.startsWith("/kitchen")) return ["kitchen", "superadmin"];

  // Driver
  if (pathname.startsWith("/driver")) return ["driver", "superadmin"];

  // Standard app (ansatt + kunde-admin + superadmin)
  if (pathname.startsWith("/week") || pathname.startsWith("/orders")) {
    return ["employee", "company_admin", "superadmin"];
  }

  // API: krever innlogging hvis protected, men alle roller kan i utgangspunktet treffe API
  if (pathname.startsWith("/api")) {
    return ["employee", "company_admin", "superadmin", "kitchen", "driver"];
  }

  return null;
}

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api");
}

/* =========================================================
   Redirect / JSON helpers
========================================================= */
function redirectToLogin(req: NextRequest, extra?: Record<string, string>) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname + (req.nextUrl.search || ""));
  if (extra) {
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

function redirectToStatus(req: NextRequest, state: CompanyStatus) {
  const url = req.nextUrl.clone();
  url.pathname = "/status";
  url.searchParams.set("state", state);
  url.searchParams.set("next", req.nextUrl.pathname + (req.nextUrl.search || ""));
  return NextResponse.redirect(url);
}

function jsonError(payload: Record<string, any>, status = 403) {
  return NextResponse.json(payload, { status });
}

/* =========================================================
   Middleware
========================================================= */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isBypassPath(pathname)) return NextResponse.next();

  // Public routes slipper gjennom (vi tvangs-redirecter ikke)
  if (isPublicPath(pathname) && !isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const protectedPath = isProtectedPath(pathname);
  if (!protectedPath) return NextResponse.next();

  // Forbered response + Supabase SSR client
  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    // Fail-closed på driftkritisk config
    if (isApiRequest(pathname)) {
      return jsonError(
        { ok: false, error: "SERVER_MISCONFIGURED", detail: "Missing Supabase env" },
        500
      );
    }
    return redirectToLogin(req, { error: "server_misconfigured" });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  // 1) Krev innlogging
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (!user || userErr) {
    if (isApiRequest(pathname)) {
      return jsonError({ ok: false, error: "AUTH_REQUIRED" }, 401);
    }
    return redirectToLogin(req);
  }

  // 2) Hent profil (rolle + company_id + is_disabled)
  // ✅ Hos dere: profiles PK = user_id
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role, company_id, is_disabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr || !profile) {
    if (isApiRequest(pathname)) {
      return jsonError({ ok: false, error: "PROFILE_MISSING" }, 403);
    }
    return redirectToLogin(req, { error: "profile_missing" });
  }

  const role = profile.role as Role;

  // ✅ 2b) Deaktivert bruker: hard stop (UI + API)
  if (profile.is_disabled === true) {
    if (isApiRequest(pathname)) {
      return jsonError({ ok: false, error: "ACCESS_DISABLED" }, 403);
    }
    return redirectToLogin(req, { disabled: "1" });
  }

  // 3) Rollebasert tilgang
  const required = requiredRolesForPath(pathname);
  if (required && !required.includes(role)) {
    if (isApiRequest(pathname)) {
      return jsonError({ ok: false, error: "FORBIDDEN_ROLE", role, required }, 403);
    }
    // enterprise-riktig: send folk til fornuftig fallback
    const url = req.nextUrl.clone();
    url.pathname = role === "superadmin" ? "/admin" : "/week";
    url.searchParams.set("forbidden", "1");
    return NextResponse.redirect(url);
  }

  // 4) Firmastatus enforcement (superadmin er ikke underlagt firmastatus)
  if (role !== "superadmin") {
    const companyId = (profile.company_id as string | null) ?? null;

    if (!companyId) {
      if (isApiRequest(pathname)) {
        return jsonError({ ok: false, error: "COMPANY_MISSING" }, 403);
      }
      return redirectToStatus(req, "paused");
    }

    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("status")
      .eq("id", companyId)
      .maybeSingle();

    if (compErr || !company) {
      // Fail-closed på driftkritisk kontroll
      if (isApiRequest(pathname)) {
        return jsonError({ ok: false, error: "COMPANY_LOOKUP_FAILED" }, 403);
      }
      return redirectToStatus(req, "paused");
    }

    const status = (company.status ?? "active") as CompanyStatus;

    if (status !== "active") {
      if (isApiRequest(pathname)) {
        return jsonError({ ok: false, error: "COMPANY_NOT_ACTIVE", status }, 403);
      }
      return redirectToStatus(req, status);
    }
  }

  return res;
}

/* =========================================================
   Matcher
   - matcher alt, men vi håndterer bypass inni middleware
========================================================= */
export const config = {
  matcher: ["/:path*"],
};
