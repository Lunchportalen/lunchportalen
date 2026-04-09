import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

import { authLog } from "@/lib/auth/log";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";
import { readLocalDevAuthSession } from "@/lib/auth/devBypass";
import { normalizeRole } from "@/lib/auth/role";
import { lookupMembership } from "@/lib/auth/membershipLookup";
import { getAuthCache, setAuthCache, type CachedAuthClaims } from "@/lib/cache/authCache";
import { getSupabasePublicConfig } from "@/lib/config/env";
import { makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import type { Database } from "@/lib/types/database";

export type AuthRole = "superadmin" | "company_admin" | "employee" | "kitchen" | "driver" | null;
export type AuthReason = "OK" | "UNAUTHENTICATED" | "NO_PROFILE" | "BLOCKED" | "ERROR";
export type AuthMode = "ANONYMOUS" | "SUPERADMIN_ALLOWLIST" | "DB_LOOKUP" | "CACHE" | "DEV_BYPASS";

export type AuthSessionSource = "SSR_COOKIE" | "BEARER" | "NONE" | "DEV_BYPASS";
export type AuthErrorType = "NONE" | "NO_SESSION" | "EXPIRED" | "INVALID" | "UNKNOWN";

export type AuthContext = {
  ok: boolean;
  reason: AuthReason;
  mode: AuthMode;
  user: { id: string; email: string | null } | null;
  role: AuthRole;
  company_id: string | null;
  location_id: string | null;
  rid: string;

  userId: string | null;
  email: string | null;
  isAuthenticated: boolean;
  isSessionValid: boolean;
  isRefreshable: boolean;
  hasAuthError: boolean;
  errorType: AuthErrorType;
  source: AuthSessionSource;
  /** Auth-only: identity + session JWT valid (no membership / role checks). */
  sessionOk: boolean;
  shouldAttemptRefresh: boolean;
};

type GetAuthContextInput = {
  rid?: string;
  reqHeaders?: Headers | null;
};

type AuthLayer = Pick<
  AuthContext,
  | "userId"
  | "email"
  | "isAuthenticated"
  | "isSessionValid"
  | "isRefreshable"
  | "hasAuthError"
  | "errorType"
  | "source"
  | "sessionOk"
  | "shouldAttemptRefresh"
>;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function parseCookieHeader(raw: string): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];
  if (!raw) return out;

  for (const part of raw.split(";")) {
    const entry = part.trim();
    if (!entry) continue;
    const index = entry.indexOf("=");
    if (index === -1) continue;
    const name = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!name) continue;
    out.push({ name, value });
  }

  return out;
}

type CookieSnapshot = {
  get(name: string): { value: string } | undefined;
  getAll(): Array<{ name: string; value: string }>;
};

function cookieSnapshotFromHeaders(headers: Headers): CookieSnapshot {
  const all = parseCookieHeader(safeStr(headers.get("cookie")));
  return {
    get(name: string) {
      const match = all.find((entry) => entry.name === name);
      return match ? { value: match.value } : undefined;
    },
    getAll() {
      return all.slice();
    },
  };
}

/**
 * Canonical session signal: Supabase SSR `sb-*-auth-token*` cookies.
 * `BEARER` is **only** `Authorization: Bearer …` (no cookie-stored access token fallback).
 */
function getAuthSessionSource(cookieStore: CookieSnapshot, headers?: Headers | null): AuthSessionSource {
  if (hasSupabaseSsrAuthCookieInJar(cookieStore.getAll())) return "SSR_COOKIE";
  const authHeader = safeStr(headers?.get("authorization"));
  if (/^bearer\s+\S+/i.test(authHeader)) return "BEARER";
  return "NONE";
}

function bearerTokenFromHeaders(headers: Headers | null): string | null {
  const raw = safeStr(headers?.get("authorization"));
  const match = raw.match(/^bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function supabaseFromHeaders(cookieStore: CookieSnapshot, headers: Headers) {
  const { url, anonKey } = getSupabasePublicConfig();
  const bearer = bearerTokenFromHeaders(headers);
  const accessToken = bearer;

  if (hasSupabaseSsrAuthCookieInJar(cookieStore.getAll())) {
    return createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll() {
          return;
        },
      },
    });
  }

  if (accessToken) {
    return createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll() {
        return;
      },
    },
  });
}

function redactEmail(raw: unknown) {
  const email = safeStr(raw).toLowerCase();
  if (!email) return "";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const keep = local.slice(0, 2);
  return `${keep}${local.length > 2 ? "***" : ""}@${domain}`;
}

function classifyAuthErrorType(
  source: AuthSessionSource,
  user: { id: string; email?: string | null } | null,
  error: { message?: string } | null
): AuthErrorType {
  if (!error && user?.id) return "NONE";
  if (!error && !user?.id) {
    return source === "NONE" ? "NO_SESSION" : "UNKNOWN";
  }
  const msg = safeStr(error?.message).toLowerCase();
  if (msg.includes("jwt expired") || msg.includes("token expired") || msg.includes("expired")) {
    return "EXPIRED";
  }
  if (
    msg.includes("invalid jwt") ||
    msg.includes("invalid token") ||
    msg.includes("malformed") ||
    msg.includes("signature") ||
    msg.includes("bad jwt")
  ) {
    return "INVALID";
  }
  if (source === "NONE") return "NO_SESSION";
  return "UNKNOWN";
}

function buildAuthLayer(input: {
  source: AuthSessionSource;
  user: { id: string; email: string | null } | null;
  error: { message?: string } | null;
}): AuthLayer {
  const hasAuthError = Boolean(input.error);
  const isAuthenticated = Boolean(input.user?.id);
  const isSessionValid = input.error == null;
  const errorType = classifyAuthErrorType(input.source, input.user, input.error);
  const isRefreshable = input.source === "SSR_COOKIE";
  const shouldAttemptRefresh = input.source === "SSR_COOKIE" && hasAuthError;

  return {
    userId: input.user?.id ?? null,
    email: input.user?.email ?? null,
    isAuthenticated,
    isSessionValid,
    isRefreshable,
    hasAuthError,
    errorType,
    source: input.source,
    sessionOk: isAuthenticated && isSessionValid,
    shouldAttemptRefresh,
  };
}

function fallbackAuthLayer(source: AuthSessionSource, errorType: AuthErrorType): AuthLayer {
  const noSession = errorType === "NO_SESSION";
  return {
    userId: null,
    email: null,
    isAuthenticated: false,
    isSessionValid: false,
    isRefreshable: source === "SSR_COOKIE",
    hasAuthError: !noSession && errorType !== "NONE",
    errorType,
    source,
    sessionOk: false,
    shouldAttemptRefresh: false,
  };
}

function ctx(
  rid: string,
  reason: AuthReason,
  mode: AuthMode,
  user: { id: string; email: string | null } | null,
  role: AuthRole,
  company_id: string | null,
  location_id: string | null,
  layer: AuthLayer
): AuthContext {
  return {
    ok: reason === "OK",
    reason,
    mode,
    user,
    role,
    company_id,
    location_id,
    rid,
    ...layer,
  };
}

function unauthenticated(rid: string, layer: AuthLayer): AuthContext {
  return ctx(rid, "UNAUTHENTICATED", "ANONYMOUS", null, null, null, null, layer);
}

function noProfile(
  user: { id: string; email: string | null } | null,
  rid: string,
  mode: AuthMode,
  layer: AuthLayer
): AuthContext {
  return ctx(rid, "NO_PROFILE", mode, user, null, null, null, layer);
}

function blocked(
  user: { id: string; email: string | null } | null,
  rid: string,
  mode: AuthMode,
  layer: AuthLayer
): AuthContext {
  return ctx(rid, "BLOCKED", mode, user, null, null, null, layer);
}

function errorCtx(
  rid: string,
  user: { id: string; email: string | null } | null,
  layer: AuthLayer
): AuthContext {
  return ctx(rid, "ERROR", "DB_LOOKUP", user, null, null, null, layer);
}

/** Map DB/RPC membership role til AuthRole (allowlistSuperadmin reservert for fremtidig bruk). */
function mapMembershipRoleToAuthRole(opts: {
  allowlistSuperadmin: boolean;
  membershipRoleRaw: string | null | undefined;
}): AuthRole | null {
  void opts.allowlistSuperadmin;
  return normalizeRole(opts.membershipRoleRaw) as AuthRole | null;
}

function needsCompany(role: AuthRole) {
  return role === "company_admin" || role === "employee" || role === "kitchen" || role === "driver";
}

function needsLocation(role: AuthRole) {
  return role === "kitchen" || role === "driver";
}

function normalizeStatus(raw: unknown): string | null {
  const status = safeStr(raw).toLowerCase();
  return status || null;
}

function isBlockedStatus(status: unknown) {
  const s = normalizeStatus(status);
  return s === "blocked" || s === "disabled" || s === "inactive";
}

function isMissingRequestScopeError(error: unknown) {
  const e = error as any;
  const message = safeStr(e?.message ?? e).toLowerCase();
  const digest = safeStr(e?.digest).toLowerCase();
  const causeMessage = safeStr(e?.cause?.message).toLowerCase();
  const text = `${message} ${digest} ${causeMessage}`;

  if (text.includes("outside a request scope")) return true;
  if (text.includes("next-dynamic-api-wrong-context")) return true;
  if (text.includes("next_dynamic_api_usage")) return true;
  return false;
}

function claimsFromCache(
  rid: string,
  user: { id: string; email: string | null },
  cached: CachedAuthClaims,
  layer: AuthLayer
): AuthContext {
  const role = mapMembershipRoleToAuthRole({ allowlistSuperadmin: false, membershipRoleRaw: cached.role });
  if (!role) return noProfile(user, rid, "CACHE", layer);

  if (isBlockedStatus(cached.status)) {
    return blocked(user, rid, "CACHE", layer);
  }

  const company_id = cached.company_id ?? null;
  const location_id = cached.location_id ?? null;

  if (needsCompany(role) && !company_id) return noProfile(user, rid, "CACHE", layer);
  if (needsLocation(role) && !location_id) return noProfile(user, rid, "CACHE", layer);

  return ctx(rid, "OK", "CACHE", user, role, company_id, location_id, layer);
}

async function resolveAuthContext(explicitRid?: string, reqHeaders?: Headers | null): Promise<AuthContext> {
  const rid = safeStr(explicitRid) || makeRid("rid_auth");

  let source: AuthSessionSource = "NONE";

  try {
    const cookieStore =
      reqHeaders != null ? cookieSnapshotFromHeaders(reqHeaders) : await cookies();
    // Must stay aligned with `middleware.ts` protected-path gate (`isLocalDevAuthenticatedRequest`).
    const devBypass = readLocalDevAuthSession(cookieStore);
    if (devBypass) {
      const userRef = { id: devBypass.userId, email: devBypass.email };
      authLog(rid, "dev_bypass", { email: redactEmail(devBypass.email) });
      return ctx(
        rid,
        "OK",
        "DEV_BYPASS",
        userRef,
        devBypass.role,
        devBypass.company_id,
        devBypass.location_id,
        buildAuthLayer({
          source: "DEV_BYPASS",
          user: userRef,
          error: null,
        }),
      );
    }

    source = getAuthSessionSource(cookieStore, reqHeaders);

    const sb = reqHeaders != null ? supabaseFromHeaders(cookieStore, reqHeaders) : await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;

    const layer = buildAuthLayer({
      source,
      user: user ? { id: user.id, email: user.email ?? null } : null,
      error,
    });

    authLog(rid, "auth_state", {
      source,
      hasUser: layer.isAuthenticated,
      hasAuthError: layer.hasAuthError,
      errorType: layer.errorType,
      isSessionValid: layer.isSessionValid,
      shouldAttemptRefresh: layer.shouldAttemptRefresh,
    });

    if (error || !user?.id) {
      return unauthenticated(rid, layer);
    }

    const userRef = { id: user.id, email: user.email ?? null };
    const successLayer = buildAuthLayer({ source, user: userRef, error: null });

    const allowlisted = systemRoleByEmail(user.email ?? null) === "superadmin";

    if (allowlisted) {
      authLog(rid, "allowlist", { email: redactEmail(user.email ?? null) });
      return ctx(rid, "OK", "SUPERADMIN_ALLOWLIST", userRef, "superadmin", null, null, successLayer);
    }

    const cached = await getAuthCache(user.id);
    if (cached) {
      authLog(rid, "cache_hit", { user_id: user.id, status: cached.status ?? null });
      return claimsFromCache(rid, userRef, cached, successLayer);
    }

    authLog(rid, "cache_miss", { user_id: user.id });

    const membership = await lookupMembership(sb, user.id, { rid });

    if (membership.ok === false) {
      authLog(rid, "membership_missing", {
        source: membership.source,
        reason: membership.reason,
      });

      if (membership.reason === "BLOCKED") return blocked(userRef, rid, "DB_LOOKUP", successLayer);
      if (membership.reason === "NO_PROFILE") return noProfile(userRef, rid, "DB_LOOKUP", successLayer);
      return errorCtx(rid, userRef, successLayer);
    }

    const role = mapMembershipRoleToAuthRole({ allowlistSuperadmin: false, membershipRoleRaw: membership.role });
    if (!role) return noProfile(userRef, rid, "DB_LOOKUP", successLayer);

    if (isBlockedStatus(membership.status)) return blocked(userRef, rid, "DB_LOOKUP", successLayer);

    const company_id = membership.company_id ?? null;
    const location_id = membership.location_id ?? null;

    if (needsCompany(role) && !company_id) return noProfile(userRef, rid, "DB_LOOKUP", successLayer);
    if (needsLocation(role) && !location_id) return noProfile(userRef, rid, "DB_LOOKUP", successLayer);

    await setAuthCache(user.id, {
      role,
      company_id,
      location_id,
      status: membership.status ?? "active",
      updated_at: membership.updated_at ?? new Date().toISOString(),
    });

    authLog(rid, "membership_ok", {
      source: membership.source,
      role,
      company_id: Boolean(company_id),
      location_id: Boolean(location_id),
    });

    return ctx(rid, "OK", "DB_LOOKUP", userRef, role, company_id, location_id, successLayer);
  } catch (e: any) {
    if (isMissingRequestScopeError(e)) {
      return unauthenticated(rid, fallbackAuthLayer(source, "NO_SESSION"));
    }

    authLog(rid, "unexpected_error", {
      message: safeStr(e?.message ?? e),
    });

    return errorCtx(rid, null, fallbackAuthLayer(source, "UNKNOWN"));
  }
}

const getAuthContextMemoized = cache(async () => resolveAuthContext());

export async function getAuthContext(input?: GetAuthContextInput): Promise<AuthContext> {
  const rid = safeStr(input?.rid);
  if (rid || input?.reqHeaders) return resolveAuthContext(rid, input?.reqHeaders ?? null);
  return getAuthContextMemoized();
}
