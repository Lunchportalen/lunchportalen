// app/api/auth/post-login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";

type Role = "superadmin" | "company_admin" | "employee" | "driver" | "kitchen";

/**
 * ✅ Canonical landing per role
 * - IMPORTANT: employee MUST land on /week (not /orders)
 */
function pathForRole(role: Role): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "driver") return "/driver";
  if (role === "kitchen") return "/kitchen";
  // employee (default)
  return "/week";
}

/**
 * ✅ Safe redirect target (open-redirect hardening)
 * - Only internal paths
 * - No /api/*
 * - No auth/onboarding loops
 */
function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  const n = String(next).trim();
  if (!n) return null;
  if (!n.startsWith("/")) return null;
  if (n.startsWith("//")) return null;
  if (n.startsWith("/api/")) return null;

  // Never redirect into auth/onboarding flows
  if (
    n === "/login" ||
    n.startsWith("/login/") ||
    n === "/register" ||
    n.startsWith("/register/") ||
    n === "/registrering" ||
    n.startsWith("/registrering/") ||
    n === "/forgot-password" ||
    n.startsWith("/forgot-password/") ||
    n === "/reset-password" ||
    n.startsWith("/reset-password/")
  ) {
    return null;
  }

  // Explicitly block legacy employee landing
  if (n === "/orders" || n.startsWith("/orders/")) return null;

  return n;
}

/**
 * ✅ Role-based allowlist for next
 * - superadmin: only /superadmin*
 * - company_admin: only /admin*
 * - driver: only /driver*
 * - kitchen: only /kitchen*
 * - employee: /week*, /min-side* (and optionally other employee routes you allow)
 */
function allowNextForRole(role: Role, nextPath: string | null): string | null {
  if (!nextPath) return null;

  if (role === "superadmin") return nextPath.startsWith("/superadmin") ? nextPath : null;
  if (role === "company_admin") return nextPath.startsWith("/admin") ? nextPath : null;
  if (role === "driver") return nextPath.startsWith("/driver") ? nextPath : null;
  if (role === "kitchen") return nextPath.startsWith("/kitchen") ? nextPath : null;

  // employee
  if (nextPath.startsWith("/week") || nextPath.startsWith("/min-side")) return nextPath;

  // Block everything else by default for employee
  return null;
}

export async function GET(req: NextRequest) {
  const rid = makeRid();

  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;

    const url = new URL(req.url);
    const nextRaw = url.searchParams.get("next");
    const nextSafe = safeNextPath(nextRaw);

    // No session → back to login (preserve safe next)
    if (error || !user) {
      const to = new URL("/login", req.nextUrl.origin);
      if (nextSafe) to.searchParams.set("next", nextSafe);
      to.searchParams.set("e", "no_session");

      const res = jsonOk(rid, { ok: true, target: to.toString() }, 303);
      res.headers.set("Location", to.toString());
      return res;
    }

    const roleRaw = await getRoleForUser(user.id);
    const role = (roleRaw as Role | null) ?? null;

    // Missing role → route to employee default (/week) with error code
    if (!role) {
      const to = new URL("/week", req.nextUrl.origin);
      to.searchParams.set("e", "missing_role");

      const res = jsonOk(rid, { ok: true, target: to.toString() }, 303);
      res.headers.set("Location", to.toString());
      return res;
    }

    const allowedNext = allowNextForRole(role, nextSafe);
    const targetPath = allowedNext ?? pathForRole(role);

    const to = new URL(targetPath, req.nextUrl.origin);
    const res = jsonOk(rid, { ok: true, target: to.toString() }, 303);
    res.headers.set("Location", to.toString());
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e ?? "Ukjent feil");
    return jsonErr(rid, "Kunne ikke fullføre redirect.", 500, {
      code: "POST_LOGIN_FAILED",
      detail: { message },
    });
  }
}
