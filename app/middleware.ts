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

function roleFromMetadata(user: any): Role {
  const raw = String(user?.user_metadata?.role ?? "employee").trim().toLowerCase();
  if (raw === "company_admin") return "company_admin";
  if (raw === "superadmin") return "superadmin";
  if (raw === "kitchen") return "kitchen";
  if (raw === "driver") return "driver";
  return "employee";
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
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") // API skal ikke rout'es av middleware
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
    // ✅ Onboarding er offentlig
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
 * ✅ Stram fasit:
 * superadmin@...  -> kun /superadmin
 * kjokken@...     -> kun /kitchen
 * driver@...      -> kun /driver
 * company_admin   -> kun /admin
 * employee        -> kun /week/orders/min-side
 */
function requiredRolesForPath(pathname: string): Role[] | null {
  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) return ["superadmin"];
  if (pathname === "/kitchen" || pathname.startsWith("/kitchen/")) return ["kitchen"];
  if (pathname === "/driver" || pathname.startsWith("/driver/")) return ["driver"];

  // ✅ Firma-admin: KUN /admin
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return ["company_admin"];

  // ✅ Ansattområder: KUN employee
  if (
    pathname === "/week" ||
    pathname.startsWith("/week/") ||
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname === "/min-side" ||
    pathname.startsWith("/min-side/")
  ) {
    return ["employee"];
  }

  return null;
}

function buildNextParam(pathname: string, searchParams: URLSearchParams) {
  const qs = searchParams.toString();
  return pathname + (qs ? `?${qs}` : "");
}

/**
 * Redirect som BEVARER query når dest inneholder ?...
 */
function redirectToPath(req: NextRequest, dest: string) {
  const url = req.nextUrl.clone();

  // dest kan være "/x", "/x?y=1"
  const [p, q] = String(dest).split("?");
  url.pathname = p || "/";
  url.search = q ? `?${q}` : "";
  return NextResponse.redirect(url);
}

/**
 * Parse requestedNext trygt:
 * - tillater kun interne paths som starter med "/"
 * - fjerner evt. domene hvis noen prøver å sende full URL
 */
function safeNextPath(requestedNext: string | null): string | null {
  if (!requestedNext) return null;
  const s = String(requestedNext).trim();
  if (!s) return null;

  // Hvis full URL, prøv å hente pathname
  if (s.startsWith("http://") || s.startsWith("https://")) {
    try {
      const u = new URL(s);
      return u.pathname + (u.search || "");
    } catch {
      return null;
    }
  }

  // Kun interne paths
  if (!s.startsWith("/")) return null;
  return s;
}

/**
 * ✅ Rolle-fasit: DB først (profiles.role), deretter e-post-system, deretter metadata.
 * Dette gjør at inviterte ansatte ALDRI kan få admin-rolle ved å tukle med metadata.
 */
async function computeRoleSafe(supabase: any, user: any): Promise<Role> {
  // 1) Systemkontoer hardlåses på e-post
  const emailRole = roleByEmail(user?.email);
  if (emailRole) return emailRole;

  // 2) DB-fasit (profiles.role)
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data?.role) {
      const r = String(data.role).trim().toLowerCase();
      if (r === "company_admin") return "company_admin";
      if (r === "superadmin") return "superadmin";
      if (r === "kitchen") return "kitchen";
      if (r === "driver") return "driver";
      return "employee";
    }
  } catch {
    // ignore, fallback til metadata
  }

  // 3) Fallback: metadata (men DB er fasit når den finnes)
  return roleFromMetadata(user);
}

/**
 * ✅ Disabled-fasit: profiles.disabled_at (kun for ikke-systemkontoer)
 */
async function isDisabledSafe(supabase: any, user: any): Promise<boolean> {
  const email = normEmail(user?.email);
  if (isSystemEmail(email)) return false;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("disabled_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return false;
    return !!data?.disabled_at;
  } catch {
    return false;
  }
}

/**
 * ✅ Sign out i middleware og send til login med error
 * (sikrer at deaktiverte ikke blir "dyttet tilbake" til home av public-path-reglene)
 */
async function signOutAndRedirect(req: NextRequest, dest: string, url: string, anon: string) {
  const r = redirectToPath(req, dest);

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          r.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  r.headers.set("x-lp-mw", "1");
  r.headers.set("x-lp-mw-auth", "signed-out");
  r.headers.set("x-lp-mw-disabled", "1");
  return r;
}

/**
 * Systemkontoer skal ikke respektere ?next=
 * + Beskytt mot å sende folk til feil område via ?next=
 */
async function pickLoginDestination(
  supabase: any,
  user: any,
  requestedNextRaw: string | null
): Promise<string> {
  const role = await computeRoleSafe(supabase, user);
  const home = homeForRole(role);

  const requestedNext = safeNextPath(requestedNextRaw);
  if (!requestedNext) return home;

  const email = normEmail(user?.email);
  if (isSystemEmail(email)) return home;

  // Evaluer krav basert på pathname (uten query)
  const nextPathname = requestedNext.split("?")[0] || requestedNext;
  const required = requiredRolesForPath(nextPathname);
  if (required && !required.includes(role)) return home;

  return requestedNext;
}

/* =========================================================
   Middleware
========================================================= */
export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (isBypassPath(pathname)) return NextResponse.next();

  // ✅ Response som vi kan skrive cookies på
  let res = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    // Failsafe: ikke blokkér alt hvis env mangler i dev
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

  // refresh session (leser bruker basert på cookies)
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  res.headers.set("x-lp-mw", "1");
  if (error) res.headers.set("x-lp-mw-auth", "err");

  // ✅ HARD: Deaktiverte brukere skal ut umiddelbart (signout + login)
  if (user) {
    const disabled = await isDisabledSafe(supabase, user);
    if (disabled) {
      // NB: /login er public, så dette er trygt og loop-fritt siden vi signOut'er samtidig.
      return await signOutAndRedirect(req, "/login?error=disabled", url, anon);
    }
  }

  /* =========================
     Public paths
  ========================= */
  if (isPublicPath(pathname)) {
    if (user) {
      const role = await computeRoleSafe(supabase, user);

      // ✅ Hvis innlogget og på onboarding/registrering -> send til riktig home
      if (
        pathname === "/onboarding" ||
        pathname.startsWith("/onboarding/") ||
        pathname === "/register" ||
        pathname.startsWith("/register/") ||
        pathname === "/registrering" ||
        pathname.startsWith("/registrering/")
      ) {
        return redirectToPath(req, homeForRole(role));
      }

      // ✅ Hvis innlogget og på /login -> send til ?next (hvis lovlig), ellers home
      if (pathname === "/login" || pathname.startsWith("/login/")) {
        const dest = await pickLoginDestination(supabase, user, searchParams.get("next"));
        return redirectToPath(req, dest);
      }

      // ✅ Hvis innlogget og på / -> send til home
      if (pathname === "/") {
        return redirectToPath(req, homeForRole(role));
      }
    }

    return res;
  }

  /* =========================
     Protected paths
  ========================= */
  if (isProtectedPath(pathname)) {
    // Ikke innlogget -> til login med next
    if (!user) {
      const url2 = req.nextUrl.clone();
      url2.pathname = "/login";
      url2.searchParams.set("next", buildNextParam(pathname, searchParams));
      return NextResponse.redirect(url2);
    }

    const role = await computeRoleSafe(supabase, user);
    const required = requiredRolesForPath(pathname);

    // ✅ Streng rolle-gate: feil område -> send til home
    if (required && !required.includes(role)) {
      return redirectToPath(req, homeForRole(role));
    }

    // ✅ Systemkontoer: tving alltid til sitt område (ignorér alt annet)
    const emailRole = roleByEmail(user.email);
    if (emailRole) {
      const home = homeForRole(emailRole);
      if (!(pathname === home || pathname.startsWith(home + "/"))) {
        return redirectToPath(req, home);
      }
    }

    return res;
  }

  /* =========================
     Strict overalt (ukjente/private paths)
     - Hvis ikke public og ikke bypass -> må være innlogget og sendes til home
  ========================= */
  if (!user) {
    const url2 = req.nextUrl.clone();
    url2.pathname = "/login";
    url2.searchParams.set("next", buildNextParam(pathname, searchParams));
    return NextResponse.redirect(url2);
  }

  const role = await computeRoleSafe(supabase, user);
  return redirectToPath(req, homeForRole(role));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
