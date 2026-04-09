// STATUS: KEEP

// lib/http/withRole.ts
import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

type HandlerCtx = {
  rid: string;
  scope: {
    userId?: string | null;
    role?: string | null;
    companyId?: string | null;
    locationId?: string | null;
    email?: string | null;
  };
  req: NextRequest;

  query: URLSearchParams;
  body: any;
};

type Options = {
  roles: ReadonlyArray<string>;
  requireCompanyScope?: boolean;

  /** Action label for audit/forensics */
  action?: string;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeQuery(req: NextRequest) {
  try {
    return new URL(req.url).searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function pickDeniedResponse(a: any): Response {
  // Bakoverkompatibel med ulike union-shapes:
  // - { ok:false, res }
  // - { ok:false, response }
  if (a?.res) return a.res as Response;
  if (a?.response) return a.response as Response;

  const rid = safeStr(a?.ctx?.rid) || "rid_missing";
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHORIZED");
}

/**
 * withRole:
 * - auth/scope + role gate (via routeGuard)
 * - (valgfritt) company scope gate
 * - gir handler ctx: { rid, scope, query, body }
 *
 * Viktig:
 * - readJson brukes kun for skrive-metoder
 * - aldri throw ut av wrapper (returnerer alltid jsonErr)
 */
export function withRole(opts: Options, handler: (ctx: HandlerCtx) => Promise<Response> | Response) {
  const roles = Array.isArray(opts?.roles) ? opts.roles : [];
  const action = safeStr(opts?.action) || "withRole";

  return async function wrapped(req: NextRequest): Promise<Response> {
    const a: any = await scopeOr401(req);
    if (!a?.ok) return pickDeniedResponse(a);

    const ctx = a.ctx;

    const denyRole = requireRoleOr403(ctx, action, roles);
    if (denyRole) return denyRole;

    if (opts?.requireCompanyScope) {
      const denyScope = requireCompanyScopeOr403(ctx);
      if (denyScope) return denyScope;
    }

    const query = safeQuery(req);

    // Kun parse body på write-metoder
    const m = safeStr((req as any)?.method).toUpperCase();
    const isWrite = m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
    const body = isWrite ? ((await readJson(req)) ?? {}) : {};

    try {
      return await handler({ rid: ctx.rid, scope: ctx.scope, req, query, body });
    } catch (e: any) {
      return jsonErr(ctx.rid, safeStr(e?.message) || "Unknown error", 500, { code: "UNHANDLED", detail: { at: "withRole" } });
    }
  };
}
