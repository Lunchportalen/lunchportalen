import "server-only";

import { cache } from "react";

import { lookupMembership } from "@/lib/auth/membershipLookup";
import { getAuthCache, setAuthCache, type CachedAuthClaims } from "@/lib/cache/authCache";
import { makeRid } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";

export type AuthRole = "superadmin" | "company_admin" | "employee" | "kitchen" | "driver";
export type AuthReason = "OK" | "UNAUTHENTICATED" | "NO_PROFILE" | "BLOCKED" | "ERROR";
export type AuthMode = "ANONYMOUS" | "SUPERADMIN_ALLOWLIST" | "DB_LOOKUP" | "CACHE";

export type AuthContext = {
  ok: boolean;
  reason: AuthReason;
  mode: AuthMode;
  user: { id: string; email: string | null } | null;
  role: AuthRole | null;
  company_id: string | null;
  location_id: string | null;
  rid: string;
};

type GetAuthContextInput = {
  rid?: string;
  reqHeaders?: Headers | null;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isAuthDebugEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.LP_DEBUG_AUTH === "1";
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

function authLog(rid: string, step: string, data: Record<string, unknown>) {
  if (!isAuthDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(`[auth.context] ${step}`, { rid, ...data });
}

function ctx(
  rid: string,
  reason: AuthReason,
  mode: AuthMode,
  user: { id: string; email: string | null } | null,
  role: AuthRole | null,
  company_id: string | null,
  location_id: string | null
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
  };
}

function unauthenticated(rid: string): AuthContext {
  return ctx(rid, "UNAUTHENTICATED", "ANONYMOUS", null, null, null, null);
}

function noProfile(
  user: { id: string; email: string | null } | null,
  rid: string,
  mode: AuthMode
): AuthContext {
  return ctx(rid, "NO_PROFILE", mode, user, null, null, null);
}

function blocked(
  user: { id: string; email: string | null } | null,
  rid: string,
  mode: AuthMode
): AuthContext {
  return ctx(rid, "BLOCKED", mode, user, null, null, null);
}

function errorCtx(rid: string, user: { id: string; email: string | null } | null): AuthContext {
  return ctx(rid, "ERROR", "DB_LOOKUP", user, null, null, null);
}

function normalizeRole(raw: unknown): AuthRole | null {
  const role = safeStr(raw).toLowerCase();
  if (role === "superadmin") return "superadmin";
  if (role === "company_admin" || role === "companyadmin" || role === "admin") return "company_admin";
  if (role === "employee") return "employee";
  if (role === "kitchen" || role === "kjokken") return "kitchen";
  if (role === "driver" || role === "sjafor") return "driver";
  return null;
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

function claimsFromCache(rid: string, user: { id: string; email: string | null }, cached: CachedAuthClaims): AuthContext {
  const role = normalizeRole(cached.role);
  if (!role) return noProfile(user, rid, "CACHE");

  if (isBlockedStatus(cached.status)) {
    return blocked(user, rid, "CACHE");
  }

  const company_id = cached.company_id ?? null;
  const location_id = cached.location_id ?? null;

  if (needsCompany(role) && !company_id) return noProfile(user, rid, "CACHE");
  if (needsLocation(role) && !location_id) return noProfile(user, rid, "CACHE");

  return ctx(rid, "OK", "CACHE", user, role, company_id, location_id);
}

async function resolveAuthContext(explicitRid?: string): Promise<AuthContext> {
  const rid = safeStr(explicitRid) || makeRid("rid_auth");

  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;

    authLog(rid, "auth_user", {
      hasUser: Boolean(user),
      hasAuthError: Boolean(error),
      email: redactEmail(user?.email ?? null),
    });

    if (error || !user?.id) return unauthenticated(rid);

    const userRef = { id: user.id, email: user.email ?? null };
    const allowlisted = systemRoleByEmail(user.email ?? null) === "superadmin";

    if (allowlisted) {
      authLog(rid, "allowlist", { email: redactEmail(user.email ?? null) });
      return ctx(rid, "OK", "SUPERADMIN_ALLOWLIST", userRef, "superadmin", null, null);
    }

    const cached = await getAuthCache(user.id);
    if (cached) {
      authLog(rid, "cache_hit", { user_id: user.id, status: cached.status ?? null });
      return claimsFromCache(rid, userRef, cached);
    }

    authLog(rid, "cache_miss", { user_id: user.id });

    const membership = await lookupMembership(sb, user.id, { rid });

    if (membership.ok === false) {
      authLog(rid, "membership_missing", {
        source: membership.source,
        reason: membership.reason,
      });

      if (membership.reason === "BLOCKED") return blocked(userRef, rid, "DB_LOOKUP");
      if (membership.reason === "NO_PROFILE") return noProfile(userRef, rid, "DB_LOOKUP");
      return errorCtx(rid, userRef);
    }

    const role = normalizeRole(membership.role);
    if (!role) return noProfile(userRef, rid, "DB_LOOKUP");

    if (isBlockedStatus(membership.status)) return blocked(userRef, rid, "DB_LOOKUP");

    const company_id = membership.company_id ?? null;
    const location_id = membership.location_id ?? null;

    if (needsCompany(role) && !company_id) return noProfile(userRef, rid, "DB_LOOKUP");
    if (needsLocation(role) && !location_id) return noProfile(userRef, rid, "DB_LOOKUP");

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

    return ctx(rid, "OK", "DB_LOOKUP", userRef, role, company_id, location_id);
  } catch (e: any) {
    authLog(rid, "unexpected_error", {
      message: safeStr(e?.message ?? e),
    });

    return errorCtx(rid, null);
  }
}

const getAuthContextMemoized = cache(async () => resolveAuthContext());

export async function getAuthContext(input?: GetAuthContextInput): Promise<AuthContext> {
  const rid = safeStr(input?.rid);
  if (rid) return resolveAuthContext(rid);
  return getAuthContextMemoized();
}

