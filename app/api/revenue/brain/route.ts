export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// CONTROL_TOWER_SOURCE

import type { NextRequest } from "next/server";

import { layeredGet, layeredSet } from "@/lib/cache/layeredCache";
import { countSocialLeadEvents, fetchLeadPipelineRows } from "@/lib/db/growthAdminRead";
import { normalizeLeadPipelineRow, type PipelineDealCard } from "@/lib/pipeline/dealNormalize";
import { enrichPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { calculatePipelineClosedRevenue } from "@/lib/revenue/leadPipelineAttribution";
import { getPipelineRevenueActions } from "@/lib/revenue/leadPipelineDecisions";
import { computePipelineMetrics } from "@/lib/revenue/pipelineMetrics";
import { scorePipelineLeads } from "@/lib/revenue/leadPipelineScoring";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

/** GET: samme pipeline-/inntektsgrunnlag som CEO-snapshot, med eksplisitte pipeline-metrikker. */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("revenue_brain");
  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const url = new URL(req.url);
    const noCache = url.searchParams.get("noCache") === "1";
    const cacheKey = "revenue_brain:v1";

    if (!noCache) {
      const hit = await layeredGet<Record<string, unknown>>(cacheKey);
      if (hit) {
        return jsonOk(rid, { ...hit, _cached: true }, 200);
      }
    }

    if (!hasSupabaseAdminConfig()) {
      return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
    }

    try {
      const admin = supabaseAdmin();
      const routeTag = "revenue_brain";
      const { rows, leadPipelineAvailable } = await fetchLeadPipelineRows(admin, routeTag);
      const metrics = computePipelineMetrics(rows);
      console.log("[PIPELINE_METRICS]", {
        route: routeTag,
        available: leadPipelineAvailable,
        deals: rows.length,
        totalValue: metrics.totalValue,
        weightedValue: metrics.weightedValue,
        dealCount: metrics.dealCount,
        avgDealSize: metrics.avgDealSize,
      });

      const enrichedPipeline = rows
        .map((r) => normalizeLeadPipelineRow(r))
        .filter((d): d is PipelineDealCard => d != null)
        .map((d) => enrichPipelineDeal(d));
      const topDeals = [...enrichedPipeline].sort((a, b) => b.value - a.value).slice(0, 5);
      const riskyDeals = enrichedPipeline.filter((r) => r.prediction.risk === "high");

      const revenue = calculatePipelineClosedRevenue(rows);
      const scoredLeads = scorePipelineLeads(rows);
      const revActions = getPipelineRevenueActions(rows);
      const socialLeadEventCount = await countSocialLeadEvents(admin, routeTag);

      const payload = {
        revenue,
        leads: scoredLeads,
        actions: revActions,
        socialLeadEventCount,
        dataAvailability: {
          leadPipeline: leadPipelineAvailable,
          socialEvents: socialLeadEventCount !== null,
        },
        pipelineAvailable: leadPipelineAvailable,
        pipeline: {
          deals: rows.length,
          totalValue: metrics.totalValue,
          weightedValue: metrics.weightedValue,
          dealCount: metrics.dealCount,
          avgDealSize: metrics.avgDealSize,
        },
        topDeals,
        riskyDeals,
      };
      if (!noCache) {
        await layeredSet(cacheKey, payload, 15_000);
      }
      return jsonOk(rid, payload, 200);
    } catch (e) {
      console.error("[REVENUE_BRAIN_PIPELINE]", e);
      return jsonOk(
        rid,
        {
          revenue: 0,
          leads: [],
          actions: [],
          socialLeadEventCount: null,
          dataAvailability: { leadPipeline: false, socialEvents: false },
          pipelineAvailable: false,
          pipeline: {
            deals: 0,
            totalValue: 0,
            weightedValue: 0,
            dealCount: 0,
            avgDealSize: 0,
          },
          topDeals: [],
          riskyDeals: [],
        },
        200,
      );
    }
  } catch (e) {
    console.error("[REVENUE_BRAIN_FATAL]", e);
    return jsonErr(rid, "Revenue brain midlertidig utilgjengelig.", 500, "REVENUE_BRAIN_UNHANDLED");
  }
}
