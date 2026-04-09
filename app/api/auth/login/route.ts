// app/api/auth/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { auditLog } from "@/lib/audit/log";
import {
  buildLocalDevAuthSession,
  LOCAL_DEV_AUTH_ACCESS_TOKEN,
  LOCAL_DEV_AUTH_REFRESH_TOKEN,
  writeLocalDevAuthSessionCookies,
} from "@/lib/auth/devBypass";
import {
  getLocalRuntimeAuthState,
  isLocalRuntimeLoginMatch,
  resolveLocalRuntimeLoginNext,
} from "@/lib/auth/localRuntimeAuth";
import { getSupabasePublicConfigStatus } from "@/lib/config/env-public";
import type { AuditEvent } from "@/lib/audit/types";
import { makeRid } from "@/lib/http/respond";
import type { Database } from "@/lib/types/database";
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

function errorText(error: unknown) {
  const e = error as any;
  return [safeStr(e?.message), safeStr(e?.cause?.message), safeStr(e?.code), safeStr(e?.cause?.code)]
    .filter(Boolean)
    .join(" ");
}

function isAuthBackendUnavailableError(error: unknown) {
  const text = errorText(error).toLowerCase();
  if (!text) return false;
  return [
    "fetch failed",
    "enotfound",
    "getaddrinfo",
    "name_not_resolved",
    "name not resolved",
    "econnrefused",
    "etimedout",
    "timeout",
    "dns",
    "network",
  ].some((needle) => text.includes(needle));
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

  try {
    if (!isProbablyJson(req)) {
      return err(rid, "Feil e-post eller passord.", 415, "unsupported_media_type");
    }

    const body = (await req.json().catch(() => null)) as LoginBody | null;

    const email = safeStr(body?.email).toLowerCase();
    const password = String(body?.password ?? "");
    const localRuntimeAuth = getLocalRuntimeAuthState();

    const nextFromQuery = req.nextUrl.searchParams.get("next");
    const nextSafe =
      safeNextPath(body?.next ?? nextFromQuery ?? null) ??
      (localRuntimeAuth?.defaultNext ?? "/week");

    authLog(rid, "start", {
      nextFromBody: body?.next ?? null,
      nextFromQuery,
      nextSafe,
      email: redactEmail(email),
      localRuntime: Boolean(localRuntimeAuth),
    });

    if (!email || !password) {
      return err(rid, "Feil e-post eller passord.", 400, "missing_credentials");
    }

    if (localRuntimeAuth) {
      if (!isLocalRuntimeLoginMatch({ email, password })) {
        return err(rid, "Feil e-post eller passord.", 401, "invalid_login");
      }

      const session = buildLocalDevAuthSession();
      const localNext = resolveLocalRuntimeLoginNext(nextSafe) ?? localRuntimeAuth.defaultNext;
      const res = applyNoStore(
        NextResponse.json(
          {
            ok: true,
            rid,
            next: localNext,
            data: {
              session: {
                access_token: LOCAL_DEV_AUTH_ACCESS_TOKEN,
                refresh_token: LOCAL_DEV_AUTH_REFRESH_TOKEN,
                expires_at: null,
                expires_in: null,
                token_type: "bearer",
                user: { id: session.userId, email: session.email },
              },
            },
          },
          { status: 200 },
        ),
      );
      res.headers.set("x-lp-login", "1");
      res.headers.set("x-lp-rid", rid);
      writeLocalDevAuthSessionCookies(res.cookies, session);
      return res;
    }

    const authRuntime = getSupabasePublicConfigStatus();
    if (!authRuntime.ok) {
      return err(rid, authRuntime.message, 503, "AUTH_RUNTIME_INVALID", {
        issue: authRuntime.issue,
      });
    }

    const supabaseUrl = authRuntime.url;
    const supabaseAnonKey = authRuntime.anonKey;
    const reqIsHttps = isHttpsRequest(req);
    const capturedCookies: Array<{ name: string; value: string; options?: any }> = [];

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
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

    if (error) {
      if (isAuthBackendUnavailableError(error)) {
        return err(
          rid,
          "Innloggingstjenesten svarte ikke. Kontroller auth-oppsettet for dette miljøet og prøv igjen.",
          503,
          "AUTH_BACKEND_UNREACHABLE",
        );
      }

      return err(rid, "Feil e-post eller passord.", 401, "invalid_login");
    }

    if (!data?.session || !data?.user?.id) {
      return err(rid, "Feil e-post eller passord.", 401, "invalid_login");
    }

    const session = data.session;
    const user = data.user;

    const res = applyNoStore(
      NextResponse.json(
        {
          ok: true,
          rid,
          next: nextSafe,
          data: {
            session: {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_at: session.expires_at,
              expires_in: session.expires_in,
              token_type: session.token_type,
              user: { id: user.id, email: user.email ?? null },
            },
          },
        },
        { status: 200 }
      )
    );
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

    // Canonical session: Supabase SSR auth cookies from `capturedCookies` only (middleware + `supabaseServer()`).

    authLog(rid, "response", {
      status: 200,
      next: nextSafe,
      setCookies: appliedCookies,
    });

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info("[auth]", { step: "login:api:success", rid, next: nextSafe });
    }

    const loginOk: AuditEvent = {
      action: "LOGIN",
      userId: user.id,
      role: null,
      companyId: null,
      locationId: null,
      resource: "auth:login",
      resourceId: user.id,
      metadata: { outcome: "success" },
      timestamp: Date.now(),
      rid,
    };
    auditLog(loginOk);

    return res;
  } catch (e: any) {
    if (isAuthBackendUnavailableError(e)) {
      return err(
        rid,
        "Innloggingstjenesten svarte ikke. Kontroller auth-oppsettet for dette miljøet og prøv igjen.",
        503,
        "AUTH_BACKEND_UNREACHABLE",
      );
    }

    // eslint-disable-next-line no-console
    console.error("[api/auth/login]", e?.stack || e?.message || e, { rid });
    return err(rid, "Feil e-post eller passord.", 500, "server_error");
  }
}
