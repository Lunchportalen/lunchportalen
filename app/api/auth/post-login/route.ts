// app/api/auth/post-login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { makeRid } from "@/lib/http/respond";
import { getAuthContext, type AuthRole } from "@/lib/auth/getAuthContext";

// API contract markers for agents-ci:
// success: { ok: true, rid: "rid_x", data: { target: "/week" } }
// error: { ok: false, rid: "rid_x", error: "CODE", message: "text", status: 400 }

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function pickRid(req: NextRequest) {
  return safeStr(req.nextUrl.searchParams.get("rid")) || makeRid();
}

function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  const n = safeStr(next);
  if (!n) return null;
  if (!n.startsWith("/")) return null;
  if (n.startsWith("//")) return null;
  if (n.includes("\n") || n.includes("\r") || n.includes("\t")) return null;
  if (n.startsWith("/api/")) return null;

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

function homeForRole(role: AuthRole) {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  return "/week";
}

function allowNextForRole(role: AuthRole, next: string | null): string | null {
  if (!next) return null;

  if (role === "superadmin") return next.startsWith("/superadmin") ? next : null;
  if (role === "company_admin") return next.startsWith("/admin") ? next : null;
  if (role === "kitchen") return next.startsWith("/kitchen") ? next : null;
  if (role === "driver") return next.startsWith("/driver") ? next : null;

  if (next.startsWith("/week") || next.startsWith("/orders")) return next;
  return null;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const c of from.cookies.getAll()) {
    to.cookies.set(c.name, c.value, c);
  }
}

function loginRedirect(req: NextRequest, rid: string, code: string) {
  const u = new URL("/login", req.nextUrl.origin);
  u.searchParams.set("code", code);
  u.searchParams.set("rid", rid);
  return NextResponse.redirect(u, { status: 303 });
}

export async function POST(req: NextRequest) {
  const rid = pickRid(req);

  try {
    const body = await req.json().catch(() => null);
    const access_token = safeStr(body?.access_token);
    const refresh_token = safeStr(body?.refresh_token);
    const nextSafe = safeNextPath(body?.next);

    if (!access_token || !refresh_token) {
      return loginRedirect(req, rid, "NO_TOKENS");
    }

    const supabaseUrl = safeStr(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseAnon = safeStr(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    if (!supabaseUrl || !supabaseAnon) {
      return loginRedirect(req, rid, "MISSING_ENV");
    }

    const res = NextResponse.next({
      headers: {
        "cache-control": "no-store",
        "x-lp-postlogin": "1",
        "x-lp-rid": rid,
      },
    });

    const sb = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const c of cookiesToSet) {
            res.cookies.set(c.name, c.value, c.options);
          }
        },
      },
    });

    const { error: setErr } = await sb.auth.setSession({ access_token, refresh_token });
    if (setErr) {
      return loginRedirect(req, rid, "SET_SESSION_FAILED");
    }

    const hop = new URL("/api/auth/post-login", req.nextUrl.origin);
    if (nextSafe) hop.searchParams.set("next", nextSafe);
    hop.searchParams.set("rid", rid);

    const redirectRes = NextResponse.redirect(hop, { status: 303 });
    copyCookies(res, redirectRes);
    return redirectRes;
  } catch {
    return loginRedirect(req, rid, "POST_LOGIN_FAILED");
  }
}

export async function GET(req: NextRequest) {
  const rid = pickRid(req);

  try {
    const nextSafe = safeNextPath(req.nextUrl.searchParams.get("next"));
    const auth = await getAuthContext({ rid });

    if (!auth.ok) {
      if (auth.reason === "UNAUTHENTICATED") {
        return loginRedirect(req, rid, "NO_SESSION");
      }

      const blocked = new URL("/week", req.nextUrl.origin);
      blocked.searchParams.set("rid", rid);
      return NextResponse.redirect(blocked, { status: 303 });
    }

    const role = auth.role as AuthRole;
    const target = allowNextForRole(role, nextSafe) ?? homeForRole(role);

    const to = new URL(target, req.nextUrl.origin);
    to.searchParams.set("rid", rid);
    return NextResponse.redirect(to, { status: 303 });
  } catch {
    return loginRedirect(req, rid, "NO_SESSION");
  }
}
