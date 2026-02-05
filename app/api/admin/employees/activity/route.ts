// app/api/admin/employees/activity/route.ts
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


/**
 * GET /api/admin/employees/activity
 * Roles: company_admin | superadmin
 * Runtime-only (CI-safe)
 */
export async function GET(req: NextRequest) {
  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();
    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const ctx = gate.ctx;

    const denyRole = requireRoleOr403(ctx, "admin.employees.activity", ["company_admin", "superadmin"]);
    if (denyRole) return denyRole;

    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;

    const companyId = safeStr(ctx.scope.companyId);
    if (!companyId) return jsonErr(ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

    // 🔎 Aktivitet per ansatt (tilpasser ikke schema – bruker eksisterende tabeller)
    const { data, error } = await sb
      .from("profiles")
      .select("id, full_name, last_active_at")
      .eq("company_id", companyId)
      .eq("role", "employee")
      .order("last_active_at", { ascending: false });

    if (error) {
      return jsonErr(ctx.rid, "Kunne ikke hente ansattaktivitet.", 400, { code: "DB_ERROR", detail: error.message });
    }

    return jsonOk(ctx.rid, { employees: data ?? [] });
  } catch (e: any) {
    const rid = ridFrom(req);
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: safeStr(e?.message ?? e) });
  }
}

export async function POST(req: NextRequest) {
  const rid = ridFrom(req);
  return jsonErr(rid, "Bruk GET.", 405, { code: "method_not_allowed", detail: { method: "POST" } });
}
