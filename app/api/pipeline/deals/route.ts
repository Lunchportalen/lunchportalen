export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { fetchLeadPipelineRows } from "@/lib/db/growthAdminRead";
import { normalizeLeadPipelineRow } from "@/lib/pipeline/dealNormalize";
import { enrichPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { computeForecast } from "@/lib/pipeline/forecast";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

/** GET: kanban-rader + vektet prognose (superadmin, read-only). */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("pipeline_deals");

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
  }

  try {
    const admin = supabaseAdmin();
    const { rows, leadPipelineAvailable } = await fetchLeadPipelineRows(admin, "pipeline_deals");

    if (!leadPipelineAvailable) {
      console.log("[PIPELINE_DEALS]", { rid, pipelineAvailable: false, count: 0 });
      return jsonOk(
        rid,
        {
          pipelineAvailable: false,
          deals: [] as const,
          forecast: computeForecast([]),
        },
        200,
      );
    }

    const deals = rows
      .map((r) => normalizeLeadPipelineRow(r))
      .filter((d): d is NonNullable<typeof d> => d != null)
      .map((d) => enrichPipelineDeal(d));

    const forecastInput = deals.map((d) => ({ value: d.value, probability: d.probability }));
    const forecast = computeForecast(forecastInput);

    console.log("[PIPELINE_DEALS]", {
      rid,
      pipelineAvailable: true,
      count: deals.length,
      forecast,
    });

    return jsonOk(rid, { pipelineAvailable: true, deals, forecast }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PIPELINE_DEALS_FATAL]", { rid, message: msg });
    return jsonErr(rid, "Kunne ikke hente pipeline.", 200, "PIPELINE_DEALS_FAILED");
  }
}
