// app/api/admin/deliveries/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function ridFrom(req: NextRequest) {
  return safeStr(req.headers.get("x-rid")) || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * GET /api/admin/deliveries
 * Query:
 *  - date?: YYYY-MM-DD (valgfri)
 *  - limit?: 1..200 (default 100)
 * Roles: company_admin | superadmin
 * Runtime-only (Supabase/env)
 */
export async function GET(req: NextRequest) {
  try {
    // ✅ Late import – stopper env-evaluering under next build
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const ctx = gate.ctx;

    const denyRole = requireRoleOr403(ctx, "admin.deliveries.read", ["company_admin", "superadmin"]);
    if (denyRole) return denyRole;

    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;

    const companyId = safeStr(ctx.scope.companyId);
    if (!companyId) return jsonErr(ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

    const url = new URL(req.url);
    const date = safeStr(url.searchParams.get("date"));
    const limitRaw = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(limitRaw) ? clamp(limitRaw, 1, 200) : 100;

    // Base query (tilpass til deres schema)
    // Antar deliveries har: id, date, slot, company_id, location_id, status, packed_at, delivered_at
    let q = sb
      .from("deliveries")
      .select("*")
      .order("date", { ascending: false })
      .order("slot", { ascending: true })
      .limit(limit);

    if (date) q = q.eq("date", date);
    q = q.eq("company_id", companyId);

    const { data, error } = await q;
    if (error) return jsonErr(ctx.rid, "Kunne ikke hente leveranser.", 400, { code: "DB_ERROR", detail: { message: error.message } });

    return jsonOk(ctx.rid, { deliveries: data ?? [] });
  } catch (e: any) {
    const rid = ridFrom(req);
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: safeStr(e?.message ?? e) } });
  }
}

export async function POST(req: NextRequest) {
  const rid = ridFrom(req);
  return jsonErr(rid, "Bruk GET.", 405, { code: "method_not_allowed", detail: { method: "POST" } });
}
