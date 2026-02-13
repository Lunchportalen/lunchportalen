// app/api/auth/post-login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";
import { computeRole, homeForRole, allowNextForRole, type Role } from "@/lib/auth/roles";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * ✅ Safe redirect target (open-redirect hardening)
 * - Only internal paths
 * - No /api/*
 * - No auth/onboarding loops
 * - Blocks legacy employee landing (/orders)
 */
function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  const n = safeStr(next);
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
 * ✅ Build redirect response using your jsonOk + Location header
 * - We always set Location
 * - We use 303 for safe redirect after auth
 */
function redirect303(rid: string, req: NextRequest, targetPathOrUrl: string, extra?: Record<string, any>) {
  const origin = req.nextUrl.origin;
  const to = targetPathOrUrl.startsWith("http") ? new URL(targetPathOrUrl) : new URL(targetPathOrUrl, origin);

  const res = jsonOk(rid, { ok: true, target: to.toString(), ...(extra ?? {}) }, 303);
  res.headers.set("Location", to.toString());
  res.headers.set("x-lp-postlogin", "1");
  res.headers.set("x-lp-rid", rid);
  return res;
}

export async function GET(req: NextRequest) {
  const rid = makeRid();

  try {
    const url = new URL(req.url);
    const nextRaw = url.searchParams.get("next");
    const nextSafe = safeNextPath(nextRaw);

    const sb = await supabaseServer();

    // ✅ Must use cookie-bound SSR client, otherwise you get redirect loops
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;

    // No session → back to login (preserve safe next)
    if (error || !user) {
      const to = new URL("/login", req.nextUrl.origin);
      if (nextSafe) to.searchParams.set("next", nextSafe);
      to.searchParams.set("code", "NO_SESSION");
      to.searchParams.set("rid", rid);

      return redirect303(rid, req, to.toString(), { state: "no_session" });
    }

    // profileRole (DB) is authoritative; roles.ts will fall back to metadata/email
    let profileRole: any = null;
    try {
      profileRole = await getRoleForUser(user.id);
    } catch {
      profileRole = null;
    }

    const role: Role = computeRole(user, profileRole);

    // Role-based next allowlist
    const allowedNext = allowNextForRole(role, nextSafe);

    // If next is not allowed, use canonical role landing
    const targetPath = allowedNext ?? homeForRole(role);

    return redirect303(rid, req, targetPath, {
      role,
      nextRequested: nextSafe ?? null,
      nextAllowed: allowedNext ?? null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e ?? "Ukjent feil");
    return jsonErr(rid, "Kunne ikke fullføre redirect.", 500, {
      code: "POST_LOGIN_FAILED",
      detail: { message },
    });
  }
}
