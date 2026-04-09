export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { computeCompanyAiBillingSnapshot } from "@/lib/ai/billing";
import {
  defaultAdaptiveLearning,
  enrichRecommendationsWithLearning,
} from "@/lib/ai/adaptiveLearning";
import {
  buildDecisionExplanation,
  readObjectiveWeightsFromEnv,
  resolvePlatformObjective,
  resolveStrategyOverrideLayer,
  strategyTelemetrySampleCount,
} from "@/lib/ai/businessObjective";
import { buildAiDashboardRecommendations } from "@/lib/ai/dashboardEngine";
import { listApplyOptionsForRecommendation } from "@/lib/ai/recommendationActions";
import { loadPlatformRunnerGovernance } from "@/lib/ai/runnerGovernance";
import { getPlatformAiBillingOverview } from "@/lib/ai/usageOverview";
import { getCompanyAiUsageEnforcementSnapshot } from "@/lib/ai/usage";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  companyIdFromCtx,
  q,
  requireRoleOr403,
  roleFromCtx,
  scopeOr401,
} from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

function isCompanyUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

/** Snitt justert konfidens på kost-/verktøy-anbefalinger (0–1), for kundetekst. */
function avgActionRecommendationConfidence(
  recs: Array<{ outcome_adjusted_confidence?: number; kind?: string }>,
): number | null {
  const kinds = new Set(["downgrade_model", "block_tool"]);
  const xs = recs
    .filter((r) => typeof r.kind === "string" && kinds.has(r.kind))
    .map((r) => r.outcome_adjusted_confidence)
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function countCriticalRecommendations(recs: Array<{ severity?: string }>): number {
  return recs.filter((r) => r.severity === "critical").length;
}

/**
 * GET /api/ai/usage?month=YYYY-MM&companyId=…&billing=1
 * company_admin: own company only (server scope).
 * superadmin: per-company when companyId set; platform billing overview when billing=1 and companyId omitted.
 */
export async function GET(req: NextRequest) {
  return withApiAiEntrypoint(req, "GET", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;

  const { ctx } = gate;
  const { rid } = ctx;

  const denyRole = requireRoleOr403(ctx, "ai.usage.read", ["company_admin", "superadmin"]);
  if (denyRole) return denyRole;

  const role = roleFromCtx(ctx);
  let companyId: string | null = null;

  const month = q(req, "month");
  const billingParam = q(req, "billing");
  const includeBilling = billingParam === "1" || billingParam?.toLowerCase() === "true";

  if (role === "company_admin") {
    companyId = companyIdFromCtx(ctx);
    if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
  } else {
    const fromQuery = q(req, "companyId");
    const fromQueryTrim = fromQuery?.trim() ?? "";
    /** Platform-wide billing overview: superadmin + billing=1, no companyId. */
    if (role === "superadmin" && includeBilling && !fromQueryTrim) {
      try {
        const [overview, platformGov] = await Promise.all([
          getPlatformAiBillingOverview(month),
          loadPlatformRunnerGovernance(),
        ]);
        const learning = platformGov.auto_adaptive_learning ?? defaultAdaptiveLearning();
        const objectiveWeights = readObjectiveWeightsFromEnv();
        const strategyLayer = resolveStrategyOverrideLayer(platformGov.business_engine);
        const objectiveResolved = resolvePlatformObjective(overview, learning.objective_checkpoint ?? null, {
          baseWeights: objectiveWeights,
          previous_strategy_mode: learning.strategy_state?.active_mode ?? null,
          strategy_override_layer: strategyLayer,
        });
        const rawStrict = String(process.env.AI_GOVERNANCE_AUTO_STRICT_PATTERN_MIN_SAMPLES ?? "").trim();
        const parsedStrict = rawStrict ? Number(rawStrict) : NaN;
        const strictPatternMinSamples = Math.max(
          1,
          Math.floor(Number.isFinite(parsedStrict) ? parsedStrict : 6),
        );
        const baseRecs = buildAiDashboardRecommendations(overview);
        const enriched = enrichRecommendationsWithLearning(learning, baseRecs, strictPatternMinSamples, {
          overview,
          weights: objectiveWeights,
          strategy_override_layer: strategyLayer,
        });
        const cp = learning.objective_checkpoint;
        const decision_explanation = buildDecisionExplanation(objectiveResolved, overview, {
          checkpoint_period: cp?.period ?? null,
          overview_period: overview.period,
          telemetry_samples: strategyTelemetrySampleCount(learning.strategy_state),
          avg_recommendation_confidence: avgActionRecommendationConfidence(enriched),
          critical_recommendation_count: countCriticalRecommendations(enriched),
          checkpoint_margin_usd: cp?.margin_usd ?? null,
          checkpoint_objective_score: cp?.objective_score ?? null,
        });
        const recommendations = enriched.map((r) => ({
          ...r,
          apply_options: listApplyOptionsForRecommendation(r),
        }));
        return jsonOk(rid, {
          ...overview,
          recommendations,
          business_engine: platformGov.business_engine ?? null,
          decision_explanation,
          objective: {
            score: objectiveResolved.score,
            stress: objectiveResolved.exec.stress,
            strategy_mode: objectiveResolved.strategy_mode,
            strategy_forced: objectiveResolved.strategy_forced,
            strategy_override_source: objectiveResolved.strategy_override_source,
            margin_gap_base: objectiveResolved.margin_gap_base,
            growth_gap_base: objectiveResolved.growth_gap_base,
            targets: objectiveResolved.targets,
            base_targets: objectiveResolved.base_targets,
            base_weights: objectiveResolved.base_weights,
            effective_weights: objectiveResolved.effective_weights,
            margin_gap_stress: objectiveResolved.margin_gap_stress,
            growth_gap_stress: objectiveResolved.growth_gap_stress,
            achieved_growth_rel: objectiveResolved.achieved_growth_rel,
            checkpoint_period: learning.objective_checkpoint?.period ?? null,
            strategy_state: learning.strategy_state,
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "INVALID_MONTH_PARAM") {
          return jsonErr(rid, "Ugyldig måned (forventet YYYY-MM).", 400, "INVALID_MONTH_PARAM");
        }
        if (msg.startsWith("AI_USAGE_READ_FAILED")) {
          return jsonErr(rid, "Kunne ikke lese aktivitetslogg.", 503, "AI_USAGE_READ_FAILED", msg);
        }
        if (msg.startsWith("ENTITLEMENTS_READ_FAILED")) {
          return jsonErr(rid, "Kunne ikke verifisere selskap.", 503, "ENTITLEMENTS_READ_FAILED", msg);
        }
        return jsonErr(rid, "Kunne ikke hente AI-oversikt.", 500, "USAGE_OVERVIEW_FAILED", msg);
      }
    }
    companyId = fromQueryTrim || companyIdFromCtx(ctx);
    if (!companyId) {
      return jsonErr(rid, "Oppgi companyId som query-parameter.", 400, "MISSING_COMPANY_ID");
    }
  }

  if (!isCompanyUuid(companyId)) {
    return jsonErr(rid, "Ugyldig companyId.", 400, "INVALID_COMPANY_ID");
  }

  try {
    const snapshot = await getCompanyAiUsageEnforcementSnapshot(companyId, month);
    const { limits, aggregate, period, plan } = snapshot;

    let billingBlock: Record<string, unknown> | null = null;
    if (includeBilling) {
      const bill = await computeCompanyAiBillingSnapshot(companyId, period);
      const { data: compRow } = await supabaseAdmin()
        .from("companies")
        .select("ai_billing_flagged, ai_billing_flag_reason, ai_billing_evaluated_at")
        .eq("id", companyId)
        .maybeSingle();
      billingBlock = {
        included_ai_budget_usd: bill.included_ai_budget_usd,
        estimated_cost_usd: Number(bill.estimated_cost_usd.toFixed(6)),
        overage_cost_usd: Number(bill.overage_cost_usd.toFixed(6)),
        list_mrr_usd: bill.list_mrr_usd,
        margin_vs_cost_usd:
          bill.margin_vs_cost_usd != null ? Number(bill.margin_vs_cost_usd.toFixed(6)) : null,
        flagged_over_included: bill.flagged_over_included,
        stored: {
          ai_billing_flagged: Boolean(compRow?.ai_billing_flagged),
          ai_billing_flag_reason: compRow?.ai_billing_flag_reason ?? null,
          ai_billing_evaluated_at: compRow?.ai_billing_evaluated_at ?? null,
        },
      };
    }

    return jsonOk(rid, {
      company_id: companyId,
      plan,
      period: period.periodLabel,
      period_bounds_utc: {
        start: period.periodStartIso,
        end: period.periodEndIso,
      },
      aggregate: {
        total_runs: aggregate.total_runs,
        prompt_tokens: aggregate.prompt_tokens,
        completion_tokens: aggregate.completion_tokens,
        total_tokens: aggregate.total_tokens,
        cost_estimate_usd: Number(aggregate.cost_estimate_usd.toFixed(6)),
      },
      limits: {
        max_runs_per_month: limits.maxRunsPerMonth,
        max_tokens_per_month: limits.maxTokensPerMonth,
        max_cost_usd_per_month: limits.maxCostUsdPerMonth,
      },
      remaining: {
        runs:
          limits.maxRunsPerMonth == null
            ? null
            : Math.max(0, limits.maxRunsPerMonth - aggregate.total_runs),
        tokens:
          limits.maxTokensPerMonth == null
            ? null
            : Math.max(0, limits.maxTokensPerMonth - aggregate.total_tokens),
        cost_usd:
          limits.maxCostUsdPerMonth == null
            ? null
            : Math.max(0, limits.maxCostUsdPerMonth - aggregate.cost_estimate_usd),
      },
      ...(billingBlock ? { billing: billingBlock } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "INVALID_MONTH_PARAM") {
      return jsonErr(rid, "Ugyldig måned (forventet YYYY-MM).", 400, "INVALID_MONTH_PARAM");
    }
    if (msg.startsWith("MISSING_COMPANY_ID")) {
      return jsonErr(rid, "Mangler selskap.", 400, "MISSING_COMPANY_ID");
    }
    if (msg.startsWith("ENTITLEMENTS_READ_FAILED")) {
      return jsonErr(rid, "Kunne ikke verifisere selskap.", 503, "ENTITLEMENTS_READ_FAILED", msg);
    }
    if (msg.startsWith("AI_USAGE_READ_FAILED")) {
      return jsonErr(rid, "Kunne ikke lese aktivitetslogg.", 503, "AI_USAGE_READ_FAILED", msg);
    }
    return jsonErr(rid, "Kunne ikke hente AI-bruk.", 500, "USAGE_FETCH_FAILED", msg);
  }
  });
}
