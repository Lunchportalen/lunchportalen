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
 * - resolveAdminTenantCompanyId(ctx, req) -> operativt firma for admin-ruter (company_admin låst; superadmin fra query)
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
  /**
   * Auth subject (stable identity for rate limiting etc).
   * May be null when upstream auth does not expose a subject claim.
   */
  sub: string | null;
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

/**
 * Canonical 401 response when scopeOr401(req) returned ok: false.
 * Use: const s = await scopeOr401(req); if (!s.ok) return denyResponse(s);
 * Safe when s is undefined/null: returns 401 so missing/broken auth state fails closed.
 */
export function denyResponse(s: ScopeOr401Result | null | undefined): Response {
  if (s != null && s.ok === false) return s.res ?? s.response;
  const rid = (s != null && s.ctx != null ? safeStr(s.ctx.rid) : null) || ridFallback();
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

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
 * ðŸ”’ NO-EXCEPTION RULE (system accounts):
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
  const sub = safeStr(raw?.sub) || null;

  const email = normEmail(raw?.email);
  const role = normRole(raw?.role);

  return { userId, role, companyId, locationId, email, sub };
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
    scope: { userId: null, role: null, companyId: null, locationId: null, email: null, sub: null },
  };
}

function requireKitchenDriverScopeOr403(ctx: AuthedCtx, role: AllowedRole | string | null): Response | null {
  const r = normRole(role);
  if (r !== "kitchen" && r !== "driver") return null;

  const rid = safeStr(ctx?.rid) || ridFallback();
  const companyId = safeStr(ctx?.scope?.companyId);
  const locationId = safeStr(ctx?.scope?.locationId);

  if (!companyId || !locationId) {
    return jsonErr(rid, "Scope er ikke tilordnet.", 403, "SCOPE_NOT_ASSIGNED", {
      path: ctx?.route ?? null,
      role: r,
      companyIdPresent: Boolean(companyId),
      locationIdPresent: Boolean(locationId),
    });
  }

  return null;
}

/* =========================================================
   Safe JSON (never throws)
========================================================= */

/**
 * Parse request body as JSON. On empty body or parse failure returns {} (never throws).
 * Fail-closed: callers must validate required fields; do not treat {} as valid for critical payloads.
 */
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

    // SYSTEM ROLE OVERRIDE (kun superadmin global)
    const sys = systemRoleByEmail(scope.email);
    if (sys === "superadmin") {
      scope.role = sys;
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
    const statusRaw = Number((e as any)?.status);
    const status = Number.isFinite(statusRaw) && statusRaw >= 400 && statusRaw <= 599 ? statusRaw : 401;
    const code = safeStr((e as any)?.code) || (status === 401 ? "UNAUTHORIZED" : "FORBIDDEN");
    const message = status === 401 ? "Ikke innlogget." : "Ingen tilgang.";
    const res = jsonErr(
      emptyCtx.rid,
      message,
      status,
      code,
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
      const scopeDeny = requireKitchenDriverScopeOr403(ctx, ctxRole);
      if (scopeDeny) return scopeDeny;
      return null;
    }

    // (ctx, action, allowed)
    if (args.length === 3 && typeof args[1] === "string" && Array.isArray(args[2])) {
      const action = safeStr(args[1]) || null;
      const allowed = normalizeAllowed(args[2]);

      if (!allowed.length) return jsonErr(rid, "Ingen tillatte roller er konfigurert for denne ruten.", 500, "MISCONFIGURED_ROUTE", { action });
      if (!ctxRole) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { action, path: ctx.route, role: null });
      if (!allowed.includes(ctxRole as AllowedRole)) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { action, path: ctx.route, role: ctxRole, allowed });
      const scopeDeny = requireKitchenDriverScopeOr403(ctx, ctxRole);
      if (scopeDeny) return scopeDeny;

      return null;
    }

    // (ctx, role, allowed)
    if (args.length === 3 && Array.isArray(args[2])) {
      const role = normRole(args[1]);
      const allowed = normalizeAllowed(args[2]);

      if (!allowed.length) return jsonErr(rid, "Ingen tillatte roller er konfigurert for denne ruten.", 500, "MISCONFIGURED_ROUTE");
      if (!role) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role: null });
      if (!allowed.includes(role as AllowedRole)) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role, allowed });
      const scopeDeny = requireKitchenDriverScopeOr403(ctx, role);
      if (scopeDeny) return scopeDeny;

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

    // (ctx, companyIdExpected) — må matche scope for company_admin; superadmin tillates
    const cidExpected = safeStr(args[1]);
    if (!cidExpected) {
      return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE", { path: ctx.route, role });
    }

    if (!role) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role: null });

    if (role === "company_admin") {
      if (!cidFromCtx) {
        return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE", { path: ctx.route, role });
      }
      if (cidFromCtx !== cidExpected) {
        return jsonErr(rid, "Forespurt firma matcher ikke tilknyttet firma.", 403, "COMPANY_SCOPE_MISMATCH", {
          path: ctx.route,
        });
      }
      return null;
    }

    if (role === "superadmin") return null;

    return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role });
  } catch {
    const rid = ridFallback();
    return jsonErr(rid, "requireCompanyScopeOr403 feilet uventet.", 500, "MISCONFIGURED_ROUTE");
  }
}

/**
 * Canonical firma for admin-API som tillater både `company_admin` og `superadmin`:
 * - `company_admin`: alltid `ctx.scope.companyId` (query `company_id`/`companyId` ignoreres med mindre den matcher — ellers 403).
 * - `superadmin`: `company_id` / `companyId` i URL, ellers `ctx.scope.companyId` om satt; minst én kilde kreves.
 */
export function resolveAdminTenantCompanyId(
  ctx: AuthedCtx,
  req: NextRequest
): { ok: true; companyId: string } | { ok: false; res: Response } {
  const rid = safeStr(ctx?.rid) || ridFallback();
  const role = normRole(ctx?.scope?.role);
  const scoped = safeStr(ctx?.scope?.companyId);

  let fromQuery = "";
  try {
    fromQuery = safeStr(req.nextUrl?.searchParams?.get("company_id") ?? req.nextUrl?.searchParams?.get("companyId"));
  } catch {
    fromQuery = "";
  }

  if (!role) {
    return { ok: false, res: jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role: null }) };
  }

  if (role === "company_admin") {
    if (!scoped) {
      return { ok: false, res: jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE", { path: ctx.route, role }) };
    }
    if (fromQuery && fromQuery !== scoped) {
      return {
        ok: false,
        res: jsonErr(rid, "Forespurt firma matcher ikke din tilknytning.", 403, "COMPANY_SCOPE_MISMATCH", {
          path: ctx.route,
        }),
      };
    }
    return { ok: true, companyId: scoped };
  }

  if (role === "superadmin") {
    const cid = fromQuery || scoped || "";
    if (!cid) {
      return {
        ok: false,
        res: jsonErr(rid, "Mangler company_id (query).", 403, "MISSING_COMPANY_SCOPE", { path: ctx.route, role }),
      };
    }
    return { ok: true, companyId: cid };
  }

  return { ok: false, res: jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN", { path: ctx.route, role }) };
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
    sub: safeStr(ctx?.scope?.sub) || null,
  };
}

