// app/api/admin/company/status/set/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function ridFrom(req: NextRequest) {
  return safeStr(req.headers.get("x-rid")) || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * POST /api/admin/company/status/set
 * Body: { status: "ACTIVE" | "PAUSED" | "CLOSED", companyId?: string }
 * Roles: company_admin | superadmin
 */
export async function POST(req: NextRequest) {
  const rid = ridFrom(req);
  const body = (await readJson(req)) ?? {};
  const status = safeStr(body.status).toUpperCase();

  if (!["ACTIVE", "PAUSED", "CLOSED"].includes(status)) {
    return jsonErr(rid, "Ugyldig status.", 400, { code: "BAD_STATUS", detail: { status } });
  }

  try {
    // 🔑 LATE IMPORT – stopper env-evaluering under build
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const ctx = gate.ctx;

    const denyRole = requireRoleOr403(ctx, "admin.company.status.set", ["company_admin", "superadmin"]);
    if (denyRole) return denyRole;

    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;

    const targetCompanyId = safeStr(ctx.scope.companyId);
    if (!targetCompanyId) {
      return jsonErr(ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
    }

    const { error: upErr } = await sb
      .from("companies")
      .update({ status })
      .eq("id", targetCompanyId);

    if (upErr) return jsonErr(ctx.rid, "Kunne ikke oppdatere status.", 400, { code: "DB_ERROR", detail: upErr.message });

    return jsonOk(ctx.rid, { companyId: targetCompanyId, status });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: safeStr(e?.message ?? e) });
  }
}

export async function GET(req: NextRequest) {
  const rid = ridFrom(req);
  return jsonErr(rid, "Bruk POST.", 405, { code: "method_not_allowed", detail: { method: "GET" } });
}
