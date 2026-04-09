export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { parsePeriodYm } from "@/lib/billing/periodYm";
import { loadLatestMonthlyRollupList } from "@/lib/esg/latestMonthlyRollupList";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const rawMonth = String(url.searchParams.get("month") ?? "").trim();

  if (rawMonth && !parsePeriodYm(rawMonth)) {
    return jsonErr(gate.ctx.rid, "month må være på formatet YYYY-MM.", 400, "BAD_REQUEST");
  }

  try {
    const admin = supabaseAdmin();
    const { month, items, baseline } = await loadLatestMonthlyRollupList(admin, rawMonth);
    return jsonOk(gate.ctx.rid, { month, items, baseline }, 200);
  } catch {
    return jsonErr(gate.ctx.rid, "Uventet feil ved henting av ESG-oversikt.", 500, "ESG_BACKOFFICE_FAILED");
  }
}
