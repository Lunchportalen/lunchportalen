// app/api/example/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

/**
 * Eksempel-endepunkt (Dag-10, standard)
 * - Bygger KUN på scopeOr401 + requireRoleOr403 + (valgfri) requireCompanyScopeOr403
 * - Returnerer alltid { ok:true/false, rid, ... }
 */

const allowedRoles = ["superadmin"] as const;
const requireCompanyScope = false;

/* =========================================================
   Utils (never throws)
========================================================= */
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

function qStr(req: NextRequest, key: string): string | null {
  const q = safeQuery(req);
  const v = safeStr(q.get(key));
  return v ? v : null;
}

function qBool(req: NextRequest, key: string): boolean | null {
  const q = safeQuery(req);
  const raw = q.get(key);
  if (raw == null) return null;

  const s = safeStr(raw).toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
  if (s === "0" || s === "false" || s === "no" || s === "off") return false;
  return null;
}

function qInt(req: NextRequest, key: string, fallback: number): number {
  const q = safeQuery(req);
  const raw = q.get(key);
  if (raw == null) return fallback;

  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

function denyResponse(s: any): Response {
  // Støtt union + legacy:
  if (s?.res) return s.res as Response;
  if (s?.response) return s.response as Response;

  const rid = safeStr(s?.ctx?.rid) || "rid_missing";
  return jsonErr(401, { rid }, "UNAUTHORIZED", "Du må være innlogget.");
}

/* =========================================================
   GET
========================================================= */
export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const denyRole = requireRoleOr403(ctx, "api.example.GET", allowedRoles);
  if (denyRole) return denyRole;

  if (requireCompanyScope) {
    const denyCompany = requireCompanyScopeOr403(ctx);
    if (denyCompany) return denyCompany;
  }

  const action = qStr(req, "action");
  const debug = qBool(req, "debug");
  const limit = clampInt(qInt(req, "limit", 50), 1, 200);

  if (!action) {
    return jsonErr(400, ctx, "BAD_REQUEST", "Mangler action i query (?action=...).");
  }

  return jsonOk(
    ctx,
    {
      ok: true,
      rid: ctx.rid,
      method: "GET",
      action,
      debug,
      limit,
    },
    200
  );
}

/* =========================================================
   POST
========================================================= */
export async function POST(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const denyRole = requireRoleOr403(ctx, "api.example.POST", allowedRoles);
  if (denyRole) return denyRole;

  if (requireCompanyScope) {
    const denyCompany = requireCompanyScopeOr403(ctx);
    if (denyCompany) return denyCompany;
  }

  const body = (await readJson(req)) ?? {};
  const bodyIsObject = !!body && typeof body === "object" && !Array.isArray(body);

  if (!bodyIsObject) {
    return jsonErr(400, ctx, "BAD_REQUEST", "Ugyldig body.", {
      bodyType: Array.isArray(body) ? "array" : typeof body,
    });
  }

  const action = safeStr((body as any)?.action);
  if (!action) return jsonErr(400, ctx, "BAD_REQUEST", "Mangler action.");

  return jsonOk(
    ctx,
    {
      ok: true,
      rid: ctx.rid,
      method: "POST",
      action,
      actor: {
        userId: ctx.scope?.userId ?? null,
        role: ctx.scope?.role ?? null,
        companyId: ctx.scope?.companyId ?? null,
        locationId: ctx.scope?.locationId ?? null,
        email: ctx.scope?.email ?? null,
      },
      receivedKeys: Object.keys(body as any),
    },
    200
  );
}
