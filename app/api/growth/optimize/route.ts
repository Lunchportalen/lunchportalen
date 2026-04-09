export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runProfitOptimizationPipeline } from "@/lib/growth/profitOptimizationPipeline";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/**
 * POST: kanal-ROI, forslag til budsjettfordeling, observasjoner — kun anbefaling (ingen auto-spend).
 * Logger beslutning i `ai_activity_log` med action `budget_allocation` når `log` ikke er false.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("growth_optimize");

  const body = await readJson(req).catch(() => ({}));
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const totalRaw = o.totalBudget;
  const totalBudget =
    typeof totalRaw === "number" && Number.isFinite(totalRaw) && totalRaw > 0
      ? Math.min(Math.floor(totalRaw), 1_000_000_000)
      : 100_000;
  const logDecision = o.log !== false;

  try {
    const result = await runProfitOptimizationPipeline({
      totalBudget,
      logDecision,
      rid,
    });

    return jsonOk(
      rid,
      {
        roi: result.roi,
        allocation: result.allocation,
        issues: result.issues,
        recommendations: result.recommendations,
        mode: result.mode,
        explain: result.explain,
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, msg, 500, "GROWTH_OPTIMIZE_FAILED");
  }
}
