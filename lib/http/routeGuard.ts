// lib/http/routeGuard.ts
import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, makeRid } from "@/lib/http/respond";
import { getScope } from "@/lib/auth/scope";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail as systemRoleByEmailCore } from "@/lib/system/emails";

/**
 * Standard auth+scope gate for API routes.
 *
 * Design:
 * - scopeOr401(req) -> { ok:false, res, response, ctx } | { ok:true, ctx }
 * - requireRoleOr403(...) -> Response | null
 * - requireCompanyScopeOr403(...) -> Response | null
 * - readJson(req) -> safe parse, never throws
 *
 * Viktig:
 * - Return types er Response (ikke NextResponse).
 */

export type AllowedRole = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export type ScopeLike = {
  userId: string | null;
  role: AllowedRole | string | null;
  companyId: string | null;
  locationId: string | null;
  email: string | null;
};

export type AuthedCtx = {
  rid: string;
  route: string | null;
  method: string | null;
  scope: ScopeLike;
};

export type ScopeOr401Result =
  | { ok: true; ctx: AuthedCtx }
  | { ok: false; res: Response; response: Response; ctx: AuthedCtx };

/* =========================================================
   Small utils
========================================================= */

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normRole(v: unknown): AllowedRole | string | null {
  const s = safeStr(v).toLowerCase();
  if (!s) return null;
  if (s === "admin" || s === "companyadmin" || s === "company-admin") return "company_admin";
  return s;
}

function normEmail(v: unknown) {
  const s = safeStr(v).toLowerCase();
  return s || null;
}

/**
 * 🔒 NO-EXCEPTION RULE (system accounts):
 * Systemroller er fasit og skal alltid vinne over profiles.role.
 */
function systemRoleByEmail(email: string | null | undefined): AllowedRole | null {
  return systemRoleByEmailCore(email ?? null);
}

function normalizeAllowed(allowed: ReadonlyArray<string>) {
  const allowedSet = new Set<AllowedRole>(["employee", "company_admin", "superadmin", "kitchen", "driver"]);
  return allowed
    .map((x) => safeStr(x).toLowerCase())
    .filter(Boolean)
    .filter((r) => allowedSet.has(r as AllowedRole)) as AllowedRole[];
}

function ridFallback() {
  return `rid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function ridFromReq(req: NextRequest) {
  try {
    const a = safeStr(req.headers.get("x-rid"));
    if (a) return a;

    const b = safeStr(req.headers.get("x-request-id"));
    if (b) return b;

    const c = safeStr(req.headers.get("x-correlation-id"));
    if (c) return c;
  } catch {
    // ignore
  }

  try {
    const r = safeStr(makeRid());
    if (r) return r;
  } catch {
    // ignore
  }

  return ridFallback();
}

function mapScope(raw: any): ScopeLike {
  // støtt både snake_case og camelCase
  const userId = safeStr(raw?.user_id ?? raw?.userId) || null;
  const companyId = safeStr(raw?.company_id ?? raw?.companyId) || null;
  const locationId = safeStr(raw?.location_id ?? raw?.locationId) || null;

  const email = normEmail(raw?.email);
  const role = normRole(raw?.role);

  return { userId, role, companyId, locationId, email };
}

/**
 * ✅ Fallback: hent auth fra Supabase cookie-session dersom getScope mangler felt.
 * Dette er avgjørende for system-roller dersom getScope() ikke leverer email/role.
 */
async function enrichScopeFromSupabase(scope: ScopeLike): Promise<ScopeLike> {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) return scope;

    const u = data.user;

    if (!scope.userId) scope.userId = safeStr(u.id) || null;
    if (!scope.email) scope.email = normEmail(u.email);

    return scope;
  } catch {
    return scope;
  }
}

function buildEmptyCtx(req: NextRequest, rid: string): AuthedCtx {
  return {
    rid,
    route: safeStr(req?.nextUrl?.pathname) || null,
    method: safeStr(req?.method) || null,
    scope: { userId: null, role: null, companyId: null, locationId: null, email: null },
  };
}

/* =========================================================
   Safe JSON (never throws)
========================================================= */

export async function readJson(req: NextRequest): Promise<any> {
  try {
    const t = await req.text();
    if (!t) return {};
    try {
      const j = JSON.parse(t);
      return j && typeof j === "object" ? j : {};
    } catch {
      return {};
    }
  } catch {
    return {};
  }
}

/* =========================================================
   Scope gate
========================================================= */

export async function scopeOr401(req: NextRequest): Promise<ScopeOr401Result> {
  const rid = ridFromReq(req);
  const emptyCtx = buildEmptyCtx(req, rid);

  try {
    const raw = await getScope(req);
    let scope = mapScope(raw);

    // Fallback: hent userId/email fra Supabase dersom mangler
    if (!scope.userId || !scope.email) {
      scope = await enrichScopeFromSupabase(scope);
    }

    // SYSTEM ROLE OVERRIDE (driver/kjøkken/superadmin etc.)
    const sys = systemRoleByEmail(scope.email);
    if (sys) {
      scope.role = sys;
      // systemroller er globale – nuller tenant scope
      scope.companyId = null;
      scope.locationId = null;
    }

    const ctx: AuthedCtx = {
      rid,
      route: safeStr(req?.nextUrl?.pathname) || null,
      method: safeStr(req?.method) || null,
      scope,
    };

    if (!scope.userId) {
      const res = jsonErr(
        ctx.rid,
        "Ikke innlogget.",
        401,
        "UNAUTHORIZED",
        {
          path: ctx.route,
          role: ctx.scope.role,
          companyIdPresent: Boolean(ctx.scope.companyId),
        }
      );
      return { ok: false, res, response: res, ctx };
    }

    return { ok: true, ctx };
  } catch (e: any) {
    const res = jsonErr(
      emptyCtx.rid,
      "Ikke innlogget.",
      401,
      "UNAUTHORIZED",
      {
        path: emptyCtx.route,
        message: safeStr(e?.message ?? e),
      }
    );
    return { ok: false, res, response: res, ctx: emptyCtx };
  }
}

/* =========================================================
   Role gate (403)
========================================================= */

export function requireRoleOr403(
  rid: string,
  role: string | null | undefined,
  allowed: ReadonlyArray<string>
): Response | null;

export function requireRoleOr403(
  ctx: AuthedCtx,
  allowed: ReadonlyArray<string>
): Response | null;

export function requireRoleOr403(
  ctx: AuthedCtx,
  action: string,
  allowed: ReadonlyArray<string>
): Response | null;

export function requireRoleOr403(
  ctx: AuthedCtx,
  role: string | null | undefined,
  allowed: ReadonlyArray<string>
): Response | null;

export function requireRoleOr403(...args: any[]): Response | null {
  try {
    // (rid, role, allowed)
    if (typeof args[0] === "string") {
      const rid = safeStr(args[0]) || ridFallback();
      const role = normRole(args[1]);
      const allowed = normalizeAllowed(Array.isArray(args[2]) ? args[2] : []);

      if (!allowed.length) return jsonErr(rid, "Ingen tillatte roller er konfigurert for denne ruten.", 500, "MISCONFIGURED_ROUTE");
      if (!role) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { role: null });
      if (!allowed.includes(role as AllowedRole)) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { role, allowed });

      return null;
    }

    const ctx = args[0] as AuthedCtx;
    const rid = safeStr(ctx?.rid) || ridFallback();
    const ctxRole = normRole(ctx?.scope?.role);

    // (ctx, allowed)
    if (args.length === 2 && Array.isArray(args[1])) {
      const allowed = normalizeAllowed(args[1]);
      if (!allowed.length) return jsonErr(rid, "Ingen tillatte roller er konfigurert for denne ruten.", 500, "MISCONFIGURED_ROUTE");
      if (!ctxRole) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role: null });
      if (!allowed.includes(ctxRole as AllowedRole)) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role: ctxRole, allowed });
      return null;
    }

    // (ctx, action, allowed)
    if (args.length === 3 && typeof args[1] === "string" && Array.isArray(args[2])) {
      const action = safeStr(args[1]) || null;
      const allowed = normalizeAllowed(args[2]);

      if (!allowed.length) return jsonErr(rid, "Ingen tillatte roller er konfigurert for denne ruten.", 500, "MISCONFIGURED_ROUTE", { action });
      if (!ctxRole) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { action, path: ctx.route, role: null });
      if (!allowed.includes(ctxRole as AllowedRole)) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { action, path: ctx.route, role: ctxRole, allowed });

      return null;
    }

    // (ctx, role, allowed)
    if (args.length === 3 && Array.isArray(args[2])) {
      const role = normRole(args[1]);
      const allowed = normalizeAllowed(args[2]);

      if (!allowed.length) return jsonErr(rid, "Ingen tillatte roller er konfigurert for denne ruten.", 500, "MISCONFIGURED_ROUTE");
      if (!role) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role: null });
      if (!allowed.includes(role as AllowedRole)) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role, allowed });

      return null;
    }

    return jsonErr(rid, "Ugyldig bruk av requireRoleOr403().", 500, "MISCONFIGURED_ROUTE");
  } catch {
    const rid = ridFallback();
    return jsonErr(rid, "requireRoleOr403 feilet uventet.", 500, "MISCONFIGURED_ROUTE");
  }
}

/* =========================================================
   Company scope gate (403)
========================================================= */

export function requireCompanyScopeOr403(
  rid: string,
  companyId: string | null | undefined
): Response | null;

export function requireCompanyScopeOr403(
  ctx: AuthedCtx,
  companyId: string | null | undefined
): Response | null;

export function requireCompanyScopeOr403(
  ctx: AuthedCtx,
  opts: { allowSuperadminGlobal?: boolean }
): Response | null;

export function requireCompanyScopeOr403(ctx: AuthedCtx): Response | null;

export function requireCompanyScopeOr403(...args: any[]): Response | null {
  try {
    const normOpts = (v: any) => ({
      allowSuperadminGlobal: Boolean(v?.allowSuperadminGlobal),
    });

    // (rid, companyId)
    if (typeof args[0] === "string") {
      const rid = safeStr(args[0]) || ridFallback();
      const cid = safeStr(args[1]);
      if (!cid) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
      return null;
    }

    const ctx = args[0] as AuthedCtx;
    const rid = safeStr(ctx?.rid) || ridFallback();
    const role = normRole(ctx?.scope?.role);
    const cidFromCtx = safeStr(ctx?.scope?.companyId);

    // (ctx)
    if (args.length === 1) {
      if (!role) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role: null });

      if (role !== "company_admin" && role !== "superadmin") {
        return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role });
      }

      if (!cidFromCtx) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE", { path: ctx.route, role });
      return null;
    }

    // (ctx, opts)
    if (args.length === 2 && typeof args[1] === "object") {
      const opts = normOpts(args[1]);

      if (!role) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role: null });

      if (role !== "company_admin" && role !== "superadmin") {
        return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role });
      }

      if (role === "superadmin" && opts.allowSuperadminGlobal) return null;

      if (!cidFromCtx) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE", { path: ctx.route, role });
      return null;
    }

    // (ctx, companyIdOverride)
    const cidOverride = safeStr(args[1]);
    if (!cidOverride) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE", { path: ctx.route, role });
    return null;
  } catch {
    const rid = ridFallback();
    return jsonErr(rid, "requireCompanyScopeOr403 feilet uventet.", 500, "MISCONFIGURED_ROUTE");
  }
}

/* =========================================================
   Optional helpers
========================================================= */

export function q(req: NextRequest, key: string): string | null {
  try {
    const v = req.nextUrl?.searchParams?.get(key);
    const s = safeStr(v);
    return s ? s : null;
  } catch {
    return null;
  }
}

export function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export function pickRid(v: string | AuthedCtx): string {
  try {
    const r = typeof v === "string" ? v : v?.rid;
    return safeStr(r) || ridFallback();
  } catch {
    return ridFallback();
  }
}

export function roleFromCtx(ctx: AuthedCtx): string | null {
  return normRole(ctx?.scope?.role);
}

export function companyIdFromCtx(ctx: AuthedCtx): string | null {
  const cid = safeStr(ctx?.scope?.companyId);
  return cid ? cid : null;
}

export function ctxSnapshot(ctx: AuthedCtx) {
  return {
    rid: safeStr(ctx?.rid) || null,
    route: safeStr(ctx?.route) || null,
    method: safeStr(ctx?.method) || null,
    userId: safeStr(ctx?.scope?.userId) || null,
    role: normRole(ctx?.scope?.role),
    companyId: safeStr(ctx?.scope?.companyId) || null,
    locationId: safeStr(ctx?.scope?.locationId) || null,
    email: safeStr(ctx?.scope?.email) || null,
  };
}
