// app/api/auth/logout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { clearLocalDevAuthSessionCookies } from "@/lib/auth/devBypass";
import { getSupabasePublicConfig } from "@/lib/config/env";
import { makeRid } from "@/lib/http/respond";
import type { Database } from "@/lib/types/database";

/* =========================================================
   Headers
========================================================= */

function noStoreHeaders() {
  return {
    "cache-control": "no-store, max-age=0",
    pragma: "no-cache",
    expires: "0",
  };
}

/* =========================================================
   Helpers
========================================================= */

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Hard cookie cleanup (fail-safe)
 * Supabase typically uses:
 * - sb-<project-ref>-auth-token
 * - legacy `sb-access-token` / `sb-refresh-token` (compatibility cleanup if still present)
 * - supabase-auth-token (older)
 *
 * We clear anything that *looks like* supabase auth cookies.
 */
function isSupabaseAuthCookie(name: string) {
  const n = String(name ?? "").toLowerCase();
  if (!n) return false;

  // new/typical:
  if (n.startsWith("sb-") && n.includes("-auth-token")) return true;

  // some installs:
  if (n === "sb-access-token" || n === "sb-refresh-token") return true;

  // older/fallback:
  if (n.includes("supabase") && n.includes("auth")) return true;
  if (n.includes("supabase-auth-token")) return true;

  // generic:
  if (n.includes("auth-token") && n.startsWith("sb-")) return true;

  return false;
}

function clearAuthCookies(res: NextResponse, allCookies: Array<{ name: string }>) {
  // Expire by setting empty + Max-Age=0 on root path
  for (const c of allCookies) {
    if (!isSupabaseAuthCookie(c.name)) continue;
    res.cookies.set({
      name: c.name,
      value: "",
      path: "/",
      maxAge: 0,
    });
  }
}

function jsonOk(rid: string, data: unknown, status = 200) {
  const res = NextResponse.json({ ok: true, rid, data }, { status });
  for (const [k, v] of Object.entries(noStoreHeaders())) res.headers.set(k, v);
  res.headers.set("x-lp-rid", rid);
  res.headers.set("x-lp-logout", "1");
  return res;
}

function jsonErr(rid: string, status: number, error: string, message: string, detail?: any) {
  const payload: any = { ok: false, rid, error, message, status };
  if (process.env.RC_MODE === "true" || process.env.NODE_ENV !== "production") {
    if (detail !== undefined) payload.detail = detail;
  }
  const res = NextResponse.json(payload, { status });
  for (const [k, v] of Object.entries(noStoreHeaders())) res.headers.set(k, v);
  res.headers.set("x-lp-rid", rid);
  res.headers.set("x-lp-logout", "1");
  return res;
}

function redirect303(req: NextRequest, rid: string, toPathOrUrl: string) {
  const to = toPathOrUrl.startsWith("http")
    ? new URL(toPathOrUrl)
    : new URL(toPathOrUrl, req.nextUrl.origin);

  const res = NextResponse.redirect(to, { status: 303 });

  for (const [k, v] of Object.entries(noStoreHeaders())) res.headers.set(k, v);
  res.headers.set("x-lp-rid", rid);
  res.headers.set("x-lp-logout", "1");
  return res;
}

function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  const n = safeStr(next);
  if (!n) return null;
  if (!n.startsWith("/")) return null;
  if (n.startsWith("//")) return null;
  if (/[\r\n\t]/.test(n)) return null;
  if (n.startsWith("/api/")) return null;
  if (n.startsWith("/auth/")) return null;

  // Avoid loops into auth surfaces
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
    n.startsWith("/reset-password/") ||
    n === "/onboarding" ||
    n.startsWith("/onboarding/")
  ) {
    return null;
  }

  return n;
}

function loginTarget(rid: string, nextSafe: string) {
  // Always include rid and code for deterministic UI state
  return `/login?next=${encodeURIComponent(nextSafe)}&code=LOGGED_OUT&rid=${encodeURIComponent(rid)}`;
}

async function bestEffortSignOut(rid: string) {
  const cookieStore = await cookies();

  let url: string;
  let anonKey: string;
  try {
    const pub = getSupabasePublicConfig();
    url = pub.url;
    anonKey = pub.anonKey;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn(`[logout] missing Supabase public config rid=${rid}: ${safeStr(e?.message ?? e)}`);
    return;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Next will emit Set-Cookie for these.
        // This keeps Supabase consistent, but we ALSO hard-clear afterward.
        for (const c of cookiesToSet) cookieStore.set(c.name, c.value, c.options);
      },
    },
  });

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Best effort only. Cookie clearing below is the actual loop-stopper.
      // eslint-disable-next-line no-console
      console.warn(`[logout] signOut error rid=${rid}: ${safeStr(error.message) || "Logout failed"}`);
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn(`[logout] signOut threw rid=${rid}: ${safeStr(e?.message ?? e)}`);
  }
}

/* =========================================================
   Handler
========================================================= */

export async function POST(req: NextRequest) {
  const rid = makeRid();

  // ✅ Preferred behavior for stability (stops loops)
  const REDIRECT = true;

  try {
    const cookieStore = await cookies();
    const all = cookieStore.getAll();

    const nextRaw = req.nextUrl.searchParams.get("next");
    const nextSafe = safeNextPath(nextRaw) ?? "/week";

    // 1) Supabase signOut (best effort)
    await bestEffortSignOut(rid);

    // 2) Build response (redirect by default)
    const toLogin = loginTarget(rid, nextSafe);
    const res = REDIRECT
      ? redirect303(req, rid, toLogin)
      : jsonOk(rid, { signedOut: true, next: nextSafe }, 200);

    // 3) Hard-clear any supabase auth cookies (fail-safe, loop killer)
    clearAuthCookies(res, all);
    clearLocalDevAuthSessionCookies(res.cookies);

    return res;
  } catch (e: any) {
    const msg = safeStr(e?.message ?? e) || "Unexpected error";
    return jsonErr(rid, 500, "UNEXPECTED", msg, { message: msg });
  }
}

// Fail-closed on GET (but still allow redirect for convenience in browser)
export async function GET(req: NextRequest) {
  const rid = makeRid();

  try {
    const nextRaw = req.nextUrl.searchParams.get("next");
    const nextSafe = safeNextPath(nextRaw) ?? "/week";

    const cookieStore = await cookies();
    const all = cookieStore.getAll();

    // Best-effort signOut even on GET (useful for <a href="/api/auth/logout">)
    await bestEffortSignOut(rid);

    const res = redirect303(req, rid, loginTarget(rid, nextSafe));
    clearAuthCookies(res, all);
    clearLocalDevAuthSessionCookies(res.cookies);

    return res;
  } catch (e: any) {
    const msg = safeStr(e?.message ?? e) || "Unexpected error";
    return jsonErr(rid, 500, "UNEXPECTED", msg, { message: msg });
  }
}
