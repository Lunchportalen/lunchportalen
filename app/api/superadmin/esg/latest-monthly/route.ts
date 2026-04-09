export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { parsePeriodYm } from "@/lib/billing/periodYm";
import { loadLatestMonthlyRollupList } from "@/lib/esg/latestMonthlyRollupList";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const { ctx } = gate;
  const rid = ctx.rid;

  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const url = new URL(req.url);
  const rawMonth = String(url.searchParams.get("month") ?? "").trim();

  if (rawMonth && !parsePeriodYm(rawMonth)) {
    return jsonErr(rid, "month må være på formatet YYYY-MM.", 400, "BAD_REQUEST");
  }

  try {
    const admin = supabaseAdmin();
    const { month, items, baseline } = await loadLatestMonthlyRollupList(admin, rawMonth);

    return jsonOk(rid, {
      month,
      items,
      baseline,
    });
  } catch {
    return jsonErr(rid, "Uventet feil ved henting av ESG-oversikt.", 500, "ESG_SUPERADMIN_FAILED");
  }
}
