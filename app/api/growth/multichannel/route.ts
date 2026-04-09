export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { allocateBudget } from "@/lib/growth/budget";
import { extractChannelData } from "@/lib/growth/channelData";
import { computeChannelMetrics } from "@/lib/growth/channelMetrics";
import { logMultiChannelAnalysis } from "@/lib/growth/multiChannelLog";
import { rankChannelsByEfficiency } from "@/lib/growth/multiChannelRank";
import { decideScaling } from "@/lib/growth/scaleDecision";
import { buildStrategy } from "@/lib/growth/strategy";
import { collectRevenueData } from "@/lib/revenue/collect";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

const SAFETY_NOTE =
  "Kun anbefalinger basert på faktiske ordre. Ingen automatisk mediekjøp. Budsjett krever manuell godkjenning.";

/**
 * POST: måler kanaler, sammenligner, foreslår nominell fordeling og skalering — deterministisk, forklarbar.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("growth_multichannel");

  const body = await readJson(req).catch(() => ({}));
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const totalRaw = o.totalBudget;
  const totalBudget =
    typeof totalRaw === "number" && Number.isFinite(totalRaw) && totalRaw > 0
      ? Math.min(Math.floor(totalRaw), 1_000_000_000)
      : 100_000;
  const logDecision = o.log !== false;

  try {
    const data = await collectRevenueData();
    const channelAgg = extractChannelData(data.posts, data.orders);
    const metrics = computeChannelMetrics(channelAgg);
    const scalingActions = decideScaling(metrics);
    const allocation = allocateBudget(metrics, totalBudget);
    const strategy = buildStrategy(scalingActions, allocation);
    const { bestChannel, worstChannel } = rankChannelsByEfficiency(metrics);

    if (logDecision) {
      await logMultiChannelAnalysis(rid, {
        channels: Object.keys(metrics),
        actionCount: strategy.length,
        totalBudget,
      });
    }

    return jsonOk(
      rid,
      {
        metrics,
        allocation,
        strategy,
        bestChannel,
        worstChannel,
        safetyNote: SAFETY_NOTE,
        mode: "recommendation_only" as const,
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, msg, 500, "MULTICHANNEL_ANALYSIS_FAILED");
  }
}
