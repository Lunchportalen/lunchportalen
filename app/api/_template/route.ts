// app/api/_template/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

/**
 * ✅ Standard Route Mal (Dag-10) – GET + POST
 *
 * Prinsipp:
 * - 401: scopeOr401(req) er eneste auth-gate
 * - 403: requireRoleOr403(ctx, action, allowedRoles)
 * - (valgfritt) 403: requireCompanyScopeOr403(ctx)
 * - readJson(req): aldri throw, alltid objekt (eller {})
 * - Svar: alltid { ok:true/false, rid, ... }
 */

const allowedRoles = ["superadmin"] as const;
const requireCompanyScope = false;

/* =========================================================
   Small utils (never throws)
========================================================= */
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeQuery(req: NextRequest) {
  try {
    // NextRequest.url finnes, men vi tåler alt
    return new URL(req.url).searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function denyResponse(s: any): Response {
  // Støtt union + legacy:
  // - { ok:false, res }
  // - { ok:false, response }
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

  // Rolle-gate
  const denyRole = requireRoleOr403(ctx, "api._template.GET", allowedRoles);
  if (denyRole) return denyRole;

  // Company-scope gate (valgfri)
  if (requireCompanyScope) {
    const denyCompany = requireCompanyScopeOr403(ctx);
    if (denyCompany) return denyCompany;
  }

  // Query
  const q = safeQuery(req);
  const example = safeStr(q.get("example")) || null;

  // Standard OK-svar: eksplisitt ok+rid (ikke avhengig av jsonOk-injeksjon)
  return jsonOk(
    ctx,
    {
      ok: true,
      rid: ctx.rid,
      method: "GET",
      example,
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

  // Rolle-gate
  const denyRole = requireRoleOr403(ctx, "api._template.POST", allowedRoles);
  if (denyRole) return denyRole;

  // Company-scope gate (valgfri)
  if (requireCompanyScope) {
    const denyCompany = requireCompanyScopeOr403(ctx);
    if (denyCompany) return denyCompany;
  }

  // Safe body (never throws)
  const body = (await readJson(req)) ?? {};
  const bodyIsObject = !!body && typeof body === "object" && !Array.isArray(body);

  if (!bodyIsObject) {
    return jsonErr(400, ctx, "BAD_REQUEST", "Ugyldig body.", {
      bodyType: Array.isArray(body) ? "array" : typeof body,
    });
  }

  return jsonOk(
    ctx,
    {
      ok: true,
      rid: ctx.rid,
      method: "POST",
      received: body,
    },
    200
  );
}
