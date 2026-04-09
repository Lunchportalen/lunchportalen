export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import {
  appendStrategyTimelineEntry,
  defaultAdaptiveLearning,
  parseAdaptiveLearning,
} from "@/lib/ai/adaptiveLearning";
import {
  buildDecisionExplanation,
  readObjectiveWeightsFromEnv,
  resolvePlatformObjective,
  resolveStrategyOverrideLayer,
  strategyTelemetrySampleCount,
  type StrategyMode,
} from "@/lib/ai/businessObjective";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import {
  loadPlatformRunnerGovernance,
  savePlatformRunnerGovernance,
  type PlatformRunnerGovernance,
} from "@/lib/ai/runnerGovernance";
import { getPlatformAiBillingOverview } from "@/lib/ai/usageOverview";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

function cloneLearningFromGov(gov: PlatformRunnerGovernance) {
  const raw = gov.auto_adaptive_learning;
  if (!raw) return defaultAdaptiveLearning();
  const parsed = parseAdaptiveLearning(JSON.parse(JSON.stringify(raw)));
  return parsed ?? defaultAdaptiveLearning();
}

/**
 * PATCH /api/ai/business-engine
 * Superadmin: set or clear dashboard strategy override (persisted in platform governance).
 * Body: { strategy_override: "profit" | "growth" | "balance" | "auto" | null }
 * — "auto" / null removes dashboard lock (env + automatic inference apply again).
 */
export async function PATCH(req: NextRequest) {
  return withApiAiEntrypoint(req, "PATCH", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const { ctx } = gate;
  const { rid } = ctx;

  const denyRole = requireRoleOr403(ctx, ["superadmin"]);
  if (denyRole) return denyRole;

  const body = await readJson(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonErr(rid, "Ugyldig body.", 400, "INVALID_BODY");
  }
  const raw = (body as Record<string, unknown>).strategy_override;
  const clear =
    raw === null ||
    raw === undefined ||
    (typeof raw === "string" && raw.trim().toLowerCase() === "auto");
  let mode: StrategyMode | null = null;
  if (!clear && typeof raw === "string") {
    const v = raw.trim().toLowerCase();
    if (v === "profit" || v === "growth" || v === "balance") mode = v;
    else {
      return jsonErr(
        rid,
        "strategy_override må være profit, growth, balance, auto eller null.",
        400,
        "INVALID_STRATEGY_OVERRIDE",
      );
    }
  }

  try {
    const fresh = await loadPlatformRunnerGovernance();
    const next: PlatformRunnerGovernance = { ...fresh };

    if (clear) {
      delete next.business_engine;
    } else {
      next.business_engine = { ...(fresh.business_engine ?? {}), strategy_override: mode };
    }

    const learning = cloneLearningFromGov(fresh);
    next.auto_adaptive_learning = learning;

    const overview = await getPlatformAiBillingOverview(null);
    const layer = resolveStrategyOverrideLayer(next.business_engine);
    const resolved = resolvePlatformObjective(overview, learning.objective_checkpoint ?? null, {
      baseWeights: readObjectiveWeightsFromEnv(),
      previous_strategy_mode: learning.strategy_state?.active_mode ?? null,
      strategy_override_layer: layer,
    });

    const st = learning.strategy_state;
    if (st.active_mode !== resolved.strategy_mode) {
      st.switch_count += 1;
      st.active_mode = resolved.strategy_mode;
    }
    appendStrategyTimelineEntry(learning, {
      period: overview.period,
      mode: resolved.strategy_mode,
      source: "dashboard",
      score: resolved.score,
      margin_gap_base: resolved.margin_gap_base,
      growth_gap_base: resolved.growth_gap_base,
    });
    learning.updated_at = new Date().toISOString();

    await savePlatformRunnerGovernance(next);

    const cp = learning.objective_checkpoint;
    const explanation = buildDecisionExplanation(resolved, overview, {
      checkpoint_period: cp?.period ?? null,
      overview_period: overview.period,
      telemetry_samples: strategyTelemetrySampleCount(learning.strategy_state),
      avg_recommendation_confidence: null,
      critical_recommendation_count: 0,
      checkpoint_margin_usd: cp?.margin_usd ?? null,
      checkpoint_objective_score: cp?.objective_score ?? null,
    });

    return jsonOk(rid, {
      business_engine: next.business_engine ?? null,
      objective: {
        strategy_mode: resolved.strategy_mode,
        strategy_forced: resolved.strategy_forced,
        strategy_override_source: resolved.strategy_override_source,
        score: resolved.score,
        targets: resolved.targets,
        base_targets: resolved.base_targets,
        margin_gap_base: resolved.margin_gap_base,
        growth_gap_base: resolved.growth_gap_base,
        achieved_growth_rel: resolved.achieved_growth_rel,
      },
      decision_explanation: explanation,
      strategy_state: learning.strategy_state,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "INVALID_MONTH_PARAM") {
      return jsonErr(rid, "Ugyldig måned.", 400, "INVALID_MONTH_PARAM");
    }
    if (msg.startsWith("PLATFORM_GOV_WRITE_FAILED")) {
      return jsonErr(rid, "Kunne ikke lagre plattformstyring.", 503, "PLATFORM_GOV_WRITE_FAILED", msg);
    }
    return jsonErr(rid, "Kunne ikke oppdatere forretningsmotor.", 500, "BUSINESS_ENGINE_PATCH_FAILED", msg);
  }
  });
}
