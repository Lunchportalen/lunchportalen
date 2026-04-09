export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { parsePeriodYm } from "@/lib/billing/periodYm";
import { osloPreviousPeriodYm } from "@/lib/date/osloPeriod";
import { loadLatestMonthlyRollupForCompany } from "@/lib/esg/latestMonthlyRollupList";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireCompanyScopeOr403, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const { ctx } = gate;
  const rid = ctx.rid;

  const roleDeny = requireRoleOr403(ctx, ["company_admin"]);
  if (roleDeny) return roleDeny;

  const scopeDeny = requireCompanyScopeOr403(ctx);
  if (scopeDeny) return scopeDeny;

  const companyId = safeStr(ctx.scope.companyId);
  if (!companyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "FORBIDDEN");

  const url = new URL(req.url);
  const monthInput = safeStr(url.searchParams.get("month"));
  const month = monthInput || osloPreviousPeriodYm();

  if (!parsePeriodYm(month)) {
    return jsonErr(rid, "month må være på formatet YYYY-MM.", 400, "BAD_REQUEST");
  }

  try {
    const admin = supabaseAdmin();
    const result = await loadLatestMonthlyRollupForCompany(admin, companyId, month);

    return jsonOk(rid, {
      companyId: result.companyId,
      month: result.month,
      record: result.record,
      baseline: result.baseline,
    });
  } catch {
    return jsonErr(rid, "Uventet feil ved henting av ESG-data.", 500, "ESG_LATEST_FAILED");
  }
}

