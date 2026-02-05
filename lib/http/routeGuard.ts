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
 * - Return types er Response (ikke NextResponse) for å unngå TS-mismatch (cookies).
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

function normRole(v: unknown) {
  const s = safeStr(v).toLowerCase();
  if (s === "admin" || s === "companyadmin") return "company_admin";
  return s || null;
}

function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}

/**
 * 🔒 NO-EXCEPTION RULE (system accounts):
 * Systemroller er fasit og skal alltid vinne over profiles.role.
 */
function systemRoleByEmail(email: string | null | undefined): AllowedRole | null {
  return systemRoleByEmailCore(email);
}

function normalizeAllowed(allowed: ReadonlyArray<string>) {
  const allowedSet = new Set(["employee", "company_admin", "superadmin", "kitchen", "driver"]);
  return allowed
    .map((x) => safeStr(x).toLowerCase())
    .filter(Boolean)
    .filter((r) => allowedSet.has(r));
}

function ridFallback() {
  return `rid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function ridFromReq(req: NextRequest) {
  // Prefer explicit headers first
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
  const email = safeStr(raw?.email) || null;
  const role = normRole(raw?.role);

  return { userId, role, companyId, locationId, email };
}

/**
 * ✅ Fallback: hent auth fra Supabase cookie-session dersom getScope mangler felt.
 * Dette er avgjørende for system-roller dersom getScope() ikke leverer email/role.
 */
async function enrichScopeFromSupabase(scope: ScopeLike) {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) return scope;

    const u = data.user;

    // userId/email kan mangle fra getScope i enkelte flows
    if (!scope.userId) scope.userId = safeStr(u.id) || null;
    if (!scope.email) scope.email = safeStr(u.email) || null;

    return scope;
  } catch {
    return scope;
  }
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
      if (j && typeof j === "object") return j;
      return {};
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

  // default ctx i tilfelle alt feiler
  const emptyCtx: AuthedCtx = {
    rid,
    route: safeStr(req?.nextUrl?.pathname) || null,
    method: safeStr(req?.method) || null,
    scope: { userId: null, role: null, companyId: null, locationId: null, email: null },
  };

  try {
    // getScope(req) er deres interne helper (krever req)
    const raw = await getScope(req);
    let scope = mapScope(raw);

    // ✅ Fallback: hvis getScope ikke gir email/role/userId, hent fra Supabase-cookie auth
    if (!scope.userId || !scope.email) {
      scope = await enrichScopeFromSupabase(scope);
    }

    // ✅ SYSTEM ROLE OVERRIDE (driver/kjøkken/superadmin)
    const sys = systemRoleByEmail(scope.email);
    if (sys) {
      scope.role = sys;
      // system-roller skal ikke trenge company/location scope
      scope.companyId = null;
      scope.locationId = null;
    }

    const ctx: AuthedCtx = {
      rid,
      route: safeStr(req?.nextUrl?.pathname) || null,
      method: safeStr(req?.method) || null,
      scope,
    };

    // Minimum: userId må finnes for å regne som autentisert
    if (!scope.userId) {
      const r = jsonErr(ctx.rid, "Ikke innlogget.", 401, {
        code: "UNAUTHORIZED",
        detail: {
        path: ctx.route,
        role: ctx.scope.role,
        companyIdPresent: Boolean(ctx.scope.companyId),
        },
      });
      return { ok: false as const, res: r, response: r, ctx };
    }

    return { ok: true as const, ctx };
  } catch (e: any) {
    const r = jsonErr(emptyCtx.rid, "Ikke innlogget.", 401, {
      code: "UNAUTHORIZED",
      detail: {
        path: emptyCtx.route,
        message: safeStr(e?.message ?? e),
      },
    });
    return { ok: false as const, res: r, response: r, ctx: emptyCtx };
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
  role: string | null | undefined,
  allowed: ReadonlyArray<string>
): Response | null;
export function requireRoleOr403(ctx: AuthedCtx, action: string, allowed: ReadonlyArray<string>): Response | null;
export function requireRoleOr403(ctx: AuthedCtx, allowed: ReadonlyArray<string>): Response | null;
export function requireRoleOr403(...args: any[]): Response | null {
  try {
    // A) (rid, role, allowed)
    if (typeof args[0] === "string") {
      const r = safeStr(args[0]) || ridFallback();
      const role = normRole(args[1]);
      const allowed = normalizeAllowed(Array.isArray(args[2]) ? args[2] : []);

      if (!allowed.length)
        return jsonErr(r, "Ingen tillatte roller er konfigurert for denne ruten.", 500, "MISCONFIGURED_ROUTE");
      if (!role) return jsonErr(r, "Ingen tilgang.", 403, { code: "FORBIDDEN", detail: { role: null, companyIdPresent: false } });
      if (!allowed.includes(role)) {
        return jsonErr(r, "Ingen tilgang.", 403, { code: "FORBIDDEN", detail: { role, allowed } });
      }
      return null;
    }

    const ctx = args[0] as AuthedCtx;
    const ctxRole = normRole(ctx?.scope?.role);
    const ctxRidVal = safeStr(ctx?.rid) || ridFallback();

    // D) (ctx, allowed)
    if (args.length === 2 && Array.isArray(args[1])) {
      const allowed = normalizeAllowed(args[1]);
      if (!allowed.length)
        return jsonErr(ctxRidVal, "Ingen tillatte roller er konfigurert for denne ruten.", 500, "MISCONFIGURED_ROUTE");
      if (!ctxRole)
        return jsonErr(ctxRidVal, "Ingen tilgang.", 403, {
          code: "FORBIDDEN",
          detail: {
            path: ctx.route,
            role: null,
            companyIdPresent: Boolean(ctx?.scope?.companyId),
          },
        });
      if (!allowed.includes(ctxRole)) {
        return jsonErr(ctxRidVal, "Ingen tilgang.", 403, {
          code: "FORBIDDEN",
          detail: {
            path: ctx.route,
            role: ctxRole,
            companyIdPresent: Boolean(ctx?.scope?.companyId),
            allowed,
          },
        });
      }
      return null;
    }

    // C) (ctx, action, allowed)
    if (args.length === 3 && typeof args[1] === "string" && Array.isArray(args[2])) {
      const action = safeStr(args[1]) || null;
      const allowed = normalizeAllowed(args[2]);

      if (!allowed.length)
        return jsonErr(ctxRidVal, "Ingen tillatte roller er konfigurert for denne ruten.", 500, {
          code: "MISCONFIGURED_ROUTE",
          detail: { action },
        });
      if (!ctxRole)
        return jsonErr(ctxRidVal, "Ingen tilgang.", 403, {
          code: "FORBIDDEN",
          detail: {
            action,
            path: ctx.route,
            role: null,
            companyIdPresent: Boolean(ctx?.scope?.companyId),
          },
        });
      if (!allowed.includes(ctxRole)) {
        return jsonErr(ctxRidVal, "Ingen tilgang.", 403, {
          code: "FORBIDDEN",
          detail: {
            action,
            path: ctx.route,
            role: ctxRole,
            companyIdPresent: Boolean(ctx?.scope?.companyId),
            allowed,
          },
        });
      }
      return null;
    }

    // B) (ctx, role, allowed)
    if (args.length === 3 && Array.isArray(args[2])) {
      const role = normRole(args[1]);
      const allowed = normalizeAllowed(args[2]);

      if (!allowed.length)
        return jsonErr(ctxRidVal, "Ingen tillatte roller er konfigurert for denne ruten.", 500, "MISCONFIGURED_ROUTE");
      if (!role)
        return jsonErr(ctxRidVal, "Ingen tilgang.", 403, {
          code: "FORBIDDEN",
          detail: {
            path: ctx.route,
            role: null,
            companyIdPresent: Boolean(ctx?.scope?.companyId),
          },
        });
      if (!allowed.includes(role)) {
        return jsonErr(ctxRidVal, "Ingen tilgang.", 403, {
          code: "FORBIDDEN",
          detail: {
            path: ctx.route,
            role,
            companyIdPresent: Boolean(ctx?.scope?.companyId),
            allowed,
          },
        });
      }
      return null;
    }

    // Feil bruk / ukjent signatur
    return jsonErr(ctxRidVal, "Ugyldig bruk av requireRoleOr403().", 500, "MISCONFIGURED_ROUTE");
  } catch {
    const r = ridFallback();
    return jsonErr(r, "requireRoleOr403 feilet uventet.", 500, "MISCONFIGURED_ROUTE");
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

    // A) (rid, companyId)
    if (typeof args[0] === "string") {
      const r = safeStr(args[0]) || ridFallback();
      const cid = safeStr(args[1]);
      if (!cid) {
        return jsonErr(r, "Mangler firmascope.", 403, { code: "MISSING_COMPANY_SCOPE", detail: { companyIdPresent: false } });
      }
      return null;
    }

    const ctx = args[0] as AuthedCtx;
    const role = normRole(ctx?.scope?.role);
    const cid = safeStr(ctx?.scope?.companyId);

    // C) (ctx)
    if (args.length === 1) {
      if (!role) {
        return jsonErr(ctx.rid, "Ingen tilgang.", 403, {
          code: "FORBIDDEN",
          detail: { path: ctx.route, role: null, companyIdPresent: Boolean(cid) },
        });
      }

      if (role !== "company_admin" && role !== "superadmin") {
        return jsonErr(ctx.rid, "Ingen tilgang.", 403, {
          code: "FORBIDDEN",
          detail: { path: ctx.route, role, companyIdPresent: Boolean(cid) },
        });
      }

      if (!cid) {
        return jsonErr(ctx.rid, "Mangler firmascope.", 403, {
          code: "MISSING_COMPANY_SCOPE",
          detail: { path: ctx.route, role, companyIdPresent: false },
        });
      }
      return null;
    }

    // B) (ctx, companyId)
    if (args.length === 2 && typeof args[1] === "object") {
      const opts = normOpts(args[1]);

      if (!role) {
        return jsonErr(ctx.rid, "Ingen tilgang.", 403, {
          code: "FORBIDDEN",
          detail: { path: ctx.route, role: null, companyIdPresent: Boolean(cid) },
        });
      }

      if (role !== "company_admin" && role !== "superadmin") {
        return jsonErr(ctx.rid, "Ingen tilgang.", 403, {
          code: "FORBIDDEN",
          detail: { path: ctx.route, role, companyIdPresent: Boolean(cid) },
        });
      }

      if (role === "superadmin" && opts.allowSuperadminGlobal) return null;

      if (!cid) {
        return jsonErr(ctx.rid, "Mangler firmascope.", 403, {
          code: "MISSING_COMPANY_SCOPE",
          detail: { path: ctx.route, role, companyIdPresent: false },
        });
      }
      return null;
    }

    const cidOverride = safeStr(args[1]);
    if (!cidOverride) {
      return jsonErr(ctx.rid, "Mangler firmascope.", 403, {
        code: "MISSING_COMPANY_SCOPE",
        detail: { path: ctx.route, role, companyIdPresent: false },
      });
    }
    return null;
  } catch {
    const r = ridFallback();
    return jsonErr(r, "requireCompanyScopeOr403 feilet uventet.", 500, "MISCONFIGURED_ROUTE");
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
