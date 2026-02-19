// app/api/auth/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";

type LoginBody = { email?: string; password?: string; next?: string | null };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isAuthDebugEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.LP_DEBUG_AUTH === "1";
}

function redactEmail(raw: string) {
  const email = safeStr(raw).toLowerCase();
  if (!email) return "";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const keep = local.slice(0, 2);
  return `${keep}${local.length > 2 ? "***" : ""}@${domain}`;
}

function isHttpsRequest(req: NextRequest) {
  const forwardedProto = safeStr(req.headers.get("x-forwarded-proto")).toLowerCase();
  if (forwardedProto) return forwardedProto.includes("https");
  return req.nextUrl.protocol === "https:";
}

function authLog(rid: string, step: string, data: Record<string, unknown>) {
  if (!isAuthDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(`[auth.login] ${step}`, { rid, ...data });
}

function applyNoStore(res: NextResponse) {
  const h = noStoreHeaders() as Record<string, string>;
  for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
  res.headers.set("content-type", "application/json; charset=utf-8");
  res.headers.set("x-content-type-options", "nosniff");
  return res;
}

function err(rid: string, message: string, status: number, code: string, detail?: unknown) {
  return applyNoStore(
    NextResponse.json(
      { ok: false, rid, error: code, message, status, ...(detail ? { detail } : {}) },
      { status }
    )
  );
}

function isProbablyJson(req: NextRequest) {
  const ct = String(req.headers.get("content-type") ?? "").toLowerCase();
  return ct.includes("application/json");
}

function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  const n = safeStr(next);
  if (!n) return null;
  if (!n.startsWith("/")) return null;
  if (n.startsWith("//")) return null;
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

export async function POST(req: NextRequest) {
  const rid = makeRid();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return err(rid, "Feil e-post eller passord.", 500, "missing_env", {
      missing: [
        !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
        !supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
      ].filter(Boolean),
    });
  }

  const reqIsHttps = isHttpsRequest(req);
  const capturedCookies: Array<{ name: string; value: string; options?: any }> = [];

  try {
    if (!isProbablyJson(req)) {
      return err(rid, "Feil e-post eller passord.", 415, "unsupported_media_type");
    }

    const body = (await req.json().catch(() => null)) as LoginBody | null;

    const email = safeStr(body?.email).toLowerCase();
    const password = String(body?.password ?? "");

    const nextFromQuery = req.nextUrl.searchParams.get("next");
    const nextSafe = safeNextPath(body?.next ?? nextFromQuery ?? null) ?? "/week";

    authLog(rid, "start", {
      nextFromBody: body?.next ?? null,
      nextFromQuery,
      nextSafe,
      email: redactEmail(email),
    });

    if (!email || !password) {
      return err(rid, "Feil e-post eller passord.", 400, "missing_credentials");
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            capturedCookies.push({ name, value, options });
          }
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    authLog(rid, "sign_in_result", {
      hasError: Boolean(error),
      hasSession: Boolean(data?.session),
      hasUser: Boolean(data?.user?.id),
      capturedCookieNames: capturedCookies.map((c) => c.name),
    });

    if (error || !data?.session || !data?.user?.id) {
      return err(rid, "Feil e-post eller passord.", 401, "invalid_login");
    }

    const res = applyNoStore(NextResponse.json({ ok: true, rid, next: nextSafe }, { status: 200 }));
    res.headers.set("x-lp-login", "1");
    res.headers.set("x-lp-rid", rid);

    const appliedCookies: Array<{ name: string; valueLength: number }> = [];

    for (const c of capturedCookies) {
      const patched: any = { ...(c.options ?? {}) };

      if (patched.path == null) patched.path = "/";

      if (!reqIsHttps) {
        patched.secure = false;
        if (patched.sameSite === undefined) patched.sameSite = "lax";
        delete patched.domain;
      } else {
        if (patched.secure === undefined) patched.secure = true;
        if (patched.sameSite === undefined) patched.sameSite = "lax";
      }

      res.cookies.set(c.name, c.value, patched);
      appliedCookies.push({ name: c.name, valueLength: c.value.length });
    }

    authLog(rid, "response", {
      status: 200,
      next: nextSafe,
      setCookies: appliedCookies,
    });

    return res;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[api/auth/login]", e?.stack || e?.message || e, { rid });
    return err(rid, "Feil e-post eller passord.", 500, "server_error");
  }
}
