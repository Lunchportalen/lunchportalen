// app/api/auth/redirect/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Helpers
========================================================= */

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

const ORDER_EMAIL = "ordre@lunchportalen.no";

// HARD e-post-fasit (samme logikk som middleware)
function roleByEmail(email: string | null | undefined): Role | null {
  const e = normEmail(email);
  if (e === "superadmin@lunchportalen.no") return "superadmin";
  if (e === "kjokken@lunchportalen.no") return "kitchen";
  if (e === "driver@lunchportalen.no") return "driver";
  return null;
}

function homeForRole(role: Role) {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  return "/week";
}

/**
 * Tillat kun interne path-er, aldri ekstern URL, aldri auth-sider.
 * Returnerer en trygg path eller fallback.
 */
function safeNextPath(next: string | null | undefined, fallback = "/week") {
  if (!next) return fallback;

  const n = String(next).trim();

  // kun interne relative paths
  if (!n.startsWith("/")) return fallback;
  if (n.startsWith("//")) return fallback;

  // blokker api
  if (n.startsWith("/api/")) return fallback;

  // blokker auth/offentlige auth-sider (unngå loop)
  if (
    n === "/login" ||
    n.startsWith("/login/") ||
    n === "/register" ||
    n.startsWith("/register/") ||
    n === "/registrering" ||
    n.startsWith("/registrering/") ||
    n === "/forgot-password" ||
    n.startsWith("/forgot-password/")
  ) {
    return fallback;
  }

  return n;
}

/**
 * Enkel RBAC for redirect-beslutning:
 * - superadmin kan alt
 * - company_admin kan /admin + /week (+ /outbox hvis dere vil, men vi trenger ikke)
 * - kitchen kan /kitchen
 * - driver kan /driver
 * - employee kan /week
 * - ordre@lunchportalen.no kan /outbox (hard)
 */
function canAccess(role: Role, path: string, email?: string | null) {
  const e = normEmail(email);

  // ✅ HARD: ordre-konto kan alltid gå til /outbox (og kun det "området")
  if (e === ORDER_EMAIL) {
    if (path.startsWith("/outbox")) return true;
    // la den likevel kunne gå til /week hvis dere ønsker (valgfritt):
    // if (path.startsWith("/week")) return true;
    return false;
  }

  if (role === "superadmin") return true;

  if (path.startsWith("/superadmin")) return false;

  if (path.startsWith("/admin")) return role === "company_admin";
  if (path.startsWith("/kitchen")) return role === "kitchen";
  if (path.startsWith("/driver")) return role === "driver";

  // Tillat outbox kun for superadmin (ordre håndteres over)
  if (path.startsWith("/outbox")) return false;

  // Default: /week og alt annet som ikke er "område" behandles som employee-safe
  if (path.startsWith("/week")) return true;

  return true;
}

/**
 * Finn rolle fra profiles.role, men aldri krasj hvis RLS / nett / PostgREST feiler.
 * Returnerer null hvis ikke funnet/ikke tilgjengelig.
 */
async function roleFromProfiles(sb: any, userId: string): Promise<Role | null> {
  try {
    const { data, error } = await sb.from("profiles").select("role").eq("user_id", userId).maybeSingle();
    if (error || !data) return null;

    const r = String((data as any)?.role ?? "").trim().toLowerCase();
    if (r === "company_admin") return "company_admin";
    if (r === "superadmin") return "superadmin";
    if (r === "kitchen") return "kitchen";
    if (r === "driver") return "driver";
    if (r === "employee") return "employee";

    return null;
  } catch {
    return null;
  }
}

function roleFromUserMetadata(user: any): Role | null {
  const r = String(user?.user_metadata?.role ?? "").trim().toLowerCase();
  if (r === "company_admin") return "company_admin";
  if (r === "superadmin") return "superadmin";
  if (r === "kitchen") return "kitchen";
  if (r === "driver") return "driver";
  if (r === "employee") return "employee";
  return null;
}

/* =========================================================
   Route
========================================================= */

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Les next (rå)
  const nextRaw = url.searchParams.get("next");
  const nextSafe = safeNextPath(nextRaw, "/week");

  const sb = await supabaseServer();

  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) {
    // Ikke innlogget → til login, behold trygg next
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("next", nextSafe);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const user = data.user;
  const email = normEmail(user.email);

  // ✅ HARD: ordre@... skal ALLTID til /outbox uansett next
  if (email === ORDER_EMAIL) {
    const to = new URL("/outbox", url.origin);
    return NextResponse.redirect(to, { status: 303 });
  }

  // Rolle-prioritet:
  // 1) Hard epost-fasit (systemkontoer)
  // 2) profiles.role
  // 3) user_metadata.role
  // 4) employee
  const byEmail = roleByEmail(user.email);
  const byProfiles = byEmail ? null : await roleFromProfiles(sb, user.id);
  const byMeta = byEmail || byProfiles ? null : roleFromUserMetadata(user);

  const role: Role = byEmail ?? byProfiles ?? byMeta ?? "employee";
  const home = homeForRole(role);

  const hasNext = typeof nextRaw === "string" && nextRaw.trim().length > 0;

  let target = home;
  if (hasNext) {
    const candidate = safeNextPath(nextRaw, home);
    target = canAccess(role, candidate, user.email) ? candidate : home;
  }

  const to = new URL(target, url.origin);
  return NextResponse.redirect(to, { status: 303 });
}
