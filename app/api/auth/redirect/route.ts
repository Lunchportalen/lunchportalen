// app/api/auth/redirect/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { SYSTEM_EMAILS, systemRoleByEmail } from "@/lib/system/emails";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Helpers
========================================================= */

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

// HARD e-post-fasit (samme logikk som middleware)
function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
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
 * - ordre-konto kan /outbox (hard)
 */
function canAccess(role: Role, path: string, email?: string | null) {
  const e = normEmail(email);

  // ✅ HARD: ordre-konto kan alltid gå til /outbox (og kun det "området")
  if (e === SYSTEM_EMAILS.ORDER) {
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
  const rid = makeRid();

  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
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
      const res = jsonOk(rid, { ok: true, target: loginUrl.toString() }, 303);
      res.headers.set("Location", loginUrl.toString());
      return res;
    }

    const user = data.user;
    const email = normEmail(user.email);

    // ✅ HARD: ordre-konto skal ALLTID til /outbox uansett next
    if (email === SYSTEM_EMAILS.ORDER) {
      const to = new URL("/outbox", url.origin);
      const res = jsonOk(rid, { ok: true, target: to.toString() }, 303);
      res.headers.set("Location", to.toString());
      return res;
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
    const res = jsonOk(rid, { ok: true, target: to.toString() }, 303);
    res.headers.set("Location", to.toString());
    return res;
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke fullføre redirect.", 500, { code: "REDIRECT_FAILED", detail: {
      message: String(e?.message ?? e),
    } });
  }
}
