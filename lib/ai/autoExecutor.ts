import "server-only";

import {
  applyMarginPeriodRollforward,
  applyToolCostRollforward,
  autoConfidenceForDowngrade,
  autoConfidenceForThrottle,
  companyDowngradeSuccessRate,
  defaultAdaptiveLearning,
  effectiveCooldownMs,
  mergeDriftWithAdaptive,
  parseAdaptiveLearning,
  recordDowngradeOutcome,
  recordThrottleOutcome,
  recomputeAdaptiveDerived,
  successRate,
  recordStrategyPerformance,
  syncObjectiveCheckpoint,
  toolThrottleSuccessRate,
  type AutoConfidenceBreakdown,
  type PlatformAdaptiveLearning,
} from "@/lib/ai/adaptiveLearning";
import { resolvePlatformObjective, resolveStrategyOverrideLayer } from "@/lib/ai/businessObjective";
import { loadAutoExecutionMetricsSince } from "@/lib/ai/autoExecutorMetrics";
import { buildAiDashboardRecommendations } from "@/lib/ai/dashboardEngine";
import {
  executeAiRecommendationApplyTrustedAuto,
  type AiRecommendationApplyResult,
} from "@/lib/ai/recommendationActions";
import {
  activePlatformThrottleForTool,
  isAutoExecutionFailSafeActive,
  loadCompanyRunnerGovernance,
  loadPlatformRunnerGovernance,
  savePlatformRunnerGovernance,
  type AiGovernanceAutoDriftMode,
  type PlatformAutoExecutionAdaptiveSnapshot,
  type PlatformAutoExecutionState,
  type PlatformAutoExecutionSummary,
} from "@/lib/ai/runnerGovernance";
import { getPlatformAiBillingOverview } from "@/lib/ai/usageOverview";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
}

function envInt(key: string, fallback: number): number {
  const raw = String(process.env[key] ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function envFloat(key: string, fallback: number): number {
  const raw = String(process.env[key] ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function confFields(b: AutoConfidenceBreakdown): Pick<
  AutoExecutorStep,
  "heuristic_confidence" | "learning_confidence" | "combined_auto_confidence"
> {
  return {
    heuristic_confidence: b.heuristic,
    learning_confidence: b.learning_confidence,
    combined_auto_confidence: b.combined,
  };
}

function normIdempotencyAuto(v: string): string | null {
  const s = v.trim();
  if (s.length < 8 || s.length > 160) return null;
  if (!/^[\w.:-]+$/.test(s)) return null;
  return s;
}

function resolveDriftModeFromEnv(): AiGovernanceAutoDriftMode {
  const v = String(process.env.AI_GOVERNANCE_AUTO_MODE ?? "auto").trim().toLowerCase();
  if (v === "observe" || v === "assist") return v;
  return "auto";
}

function cloneLearning(raw: PlatformAdaptiveLearning | undefined): PlatformAdaptiveLearning {
  const base = raw ? parseAdaptiveLearning(JSON.parse(JSON.stringify(raw))) : undefined;
  return base ?? defaultAdaptiveLearning();
}

export type AutoExecutorStep = {
  recommendation_id: string;
  kind: string;
  action: "downgrade_company_model_tier" | "throttle_tool_platform";
  auto_rule: string;
  idempotency_key: string;
  /** Snapshot heuristic from dashboard engine. */
  confidence?: number;
  heuristic_confidence?: number;
  learning_confidence?: number;
  combined_auto_confidence?: number;
  skipped?: string;
  result?: AiRecommendationApplyResult;
  error?: string;
};

export type AutoRecommendationExecutorResult = {
  rid: string;
  period: string;
  /** Env / cron request */
  drift_mode: AiGovernanceAutoDriftMode;
  /** After adaptive merge + fail-safe + dry_run */
  effective_mode: AiGovernanceAutoDriftMode;
  dry_run: boolean;
  observe_only: boolean;
  fail_safe: {
    active: boolean;
    disabled_until: string | null;
    consecutive_errors_before: number;
  };
  downgrades_attempted: number;
  throttles_attempted: number;
  monitoring: PlatformAutoExecutionSummary;
  steps: AutoExecutorStep[];
};

/**
 * Evaluates dashboard recommendations and auto-applies only low-risk actions,
 * with adaptive learning (confidence, dynamic cooldown/drift/threshold), caps, and fail-safe.
 */
export async function runAutoRecommendationExecutor(params: {
  rid: string;
  month?: string | null;
  dry_run?: boolean;
  mode?: AiGovernanceAutoDriftMode | null;
}): Promise<AutoRecommendationExecutorResult> {
  const { rid, month = null, dry_run = false, mode: modeOverride = null } = params;
  const overview = await getPlatformAiBillingOverview(month);
  const recs = buildAiDashboardRecommendations(overview);
  const period = overview.period;
  const periodStart = overview.period_bounds_utc.start;
  const companyById = new Map(overview.top_companies.map((c) => [c.company_id, c]));
  const toolByName = new Map(overview.by_tool.map((t) => [t.tool, t]));

  const drift_mode = modeOverride ?? resolveDriftModeFromEnv();

  const maxDown = Math.max(0, envInt("AI_GOVERNANCE_AUTO_MAX_DOWNGRADES", 10));
  const maxThrottle = Math.max(0, envInt("AI_GOVERNANCE_AUTO_MAX_THROTTLES", 3));
  const throttleHours = Math.min(168, Math.max(1, envInt("AI_GOVERNANCE_AUTO_THROTTLE_HOURS", 24)));
  const maxActionsPeriod = Math.max(0, envInt("AI_GOVERNANCE_AUTO_MAX_ACTIONS_PER_PERIOD", 40));
  const cooldownDownMs = Math.max(0, envInt("AI_GOVERNANCE_AUTO_COOLDOWN_DOWNGRADE_HOURS", 168)) * 3_600_000;
  const cooldownThrottleMs = Math.max(0, envInt("AI_GOVERNANCE_AUTO_COOLDOWN_THROTTLE_HOURS", 24)) * 3_600_000;
  const errorStreakMax = Math.max(1, envInt("AI_GOVERNANCE_AUTO_ERROR_STREAK_MAX", 3));
  const disableCooldownHours = Math.max(1, envInt("AI_GOVERNANCE_AUTO_DISABLE_COOLDOWN_HOURS", 24));
  const strictPatternMinSamples = Math.max(
    1,
    Math.floor(envFloat("AI_GOVERNANCE_AUTO_STRICT_PATTERN_MIN_SAMPLES", 6)),
  );
  const minLearningConfidence = Math.min(
    0.95,
    Math.max(0.05, envFloat("AI_GOVERNANCE_AUTO_MIN_LEARNING_CONFIDENCE", 0.4)),
  );

  let platformGov = await loadPlatformRunnerGovernance();
  const learning = cloneLearning(platformGov.auto_adaptive_learning);
  applyMarginPeriodRollforward(learning, overview);
  applyToolCostRollforward(learning, overview);

  const objectiveResolved = resolvePlatformObjective(overview, learning.objective_checkpoint ?? null, {
    previous_strategy_mode: learning.strategy_state?.active_mode ?? null,
    strategy_override_layer: resolveStrategyOverrideLayer(platformGov.business_engine),
  });
  const objectiveScore = objectiveResolved.score;
  const objectiveExec = objectiveResolved.exec;

  const effective_drift = mergeDriftWithAdaptive(drift_mode, learning.adaptive_drift);

  const aesRaw = platformGov.auto_execution_state;
  const aes: PlatformAutoExecutionState | undefined =
    aesRaw?.disabled_until && Date.parse(aesRaw.disabled_until) <= Date.now()
      ? { ...aesRaw, disabled_until: null }
      : aesRaw;
  const failSafeActive = isAutoExecutionFailSafeActive(aes);
  const consecutive_before = aes?.consecutive_errors ?? 0;

  const observe_only = dry_run || effective_drift === "observe" || failSafeActive;
  const allowDowngrade = effective_drift === "auto" && !observe_only;
  const allowThrottle = (effective_drift === "auto" || effective_drift === "assist") && !observe_only;

  const metrics = await loadAutoExecutionMetricsSince(periodStart);
  const lastDown = new Map(metrics.last_downgrade_at_by_company);
  const lastThrottle = new Map(metrics.last_throttle_at_by_tool);
  const periodApplyCountStart = metrics.total_auto_applies;
  let appliedThisRun = 0;

  const steps: AutoExecutorStep[] = [];
  let downgrades_attempted = 0;
  let throttles_attempted = 0;
  let cooldown_skipped = 0;
  let period_cap_skipped = 0;
  let fail_safe_skipped = 0;
  let confidence_threshold_skipped = 0;
  let learning_gate_skipped = 0;

  const canApplyMore = (): boolean => {
    if (maxActionsPeriod < 0) return true;
    return periodApplyCountStart + appliedThisRun < maxActionsPeriod;
  };

  const bumpAppliedIfNew = (r: AiRecommendationApplyResult) => {
    if (!r.idempotent_replay) appliedThisRun += 1;
  };

  const recordLearning = !dry_run;

  for (const r of recs) {
    if (r.kind === "downgrade_model") {
      if (downgrades_attempted >= maxDown) break;
      const cid = r.refs?.company_id;
      if (!cid || !isUuid(cid)) continue;

      const idem = normIdempotencyAuto(`auto_${period}_down_${cid}`);
      if (!idem) continue;

      if (r.severity === "critical") {
        steps.push({
          recommendation_id: r.id,
          kind: r.kind,
          action: "downgrade_company_model_tier",
          auto_rule: "margin_downgrade_auto",
          idempotency_key: idem,
          confidence: r.confidence,
          skipped: "critical_severity_requires_manual_review",
        });
        continue;
      }

      if (!allowDowngrade) {
        steps.push({
          recommendation_id: r.id,
          kind: r.kind,
          action: "downgrade_company_model_tier",
          auto_rule: "margin_downgrade_auto",
          idempotency_key: idem,
          confidence: r.confidence,
          skipped: failSafeActive
            ? "fail_safe_disabled"
            : dry_run
              ? "dry_run"
              : effective_drift === "observe"
                ? "observe_mode_no_mutation"
                : "assist_mode_downgrade_disabled",
        });
        if (failSafeActive) fail_safe_skipped += 1;
        continue;
      }

      const coGov = await loadCompanyRunnerGovernance(cid);
      if (coGov.model_tier === "economy") {
        steps.push({
          recommendation_id: r.id,
          kind: r.kind,
          action: "downgrade_company_model_tier",
          auto_rule: "margin_downgrade_auto",
          idempotency_key: idem,
          confidence: r.confidence,
          skipped: "already_economy",
        });
        continue;
      }

      const downBreak = autoConfidenceForDowngrade(
        learning,
        r.confidence,
        cid,
        strictPatternMinSamples,
        objectiveExec,
      );

      if (downBreak.combined < learning.min_auto_confidence) {
        confidence_threshold_skipped += 1;
        steps.push({
          recommendation_id: r.id,
          kind: r.kind,
          action: "downgrade_company_model_tier",
          auto_rule: "margin_downgrade_auto",
          idempotency_key: idem,
          confidence: r.confidence,
          ...confFields(downBreak),
          skipped: "below_min_auto_confidence",
        });
        continue;
      }

      if (downBreak.strict_pattern && downBreak.learning_confidence < minLearningConfidence) {
        learning_gate_skipped += 1;
        steps.push({
          recommendation_id: r.id,
          kind: r.kind,
          action: "downgrade_company_model_tier",
          auto_rule: "margin_downgrade_auto",
          idempotency_key: idem,
          confidence: r.confidence,
          ...confFields(downBreak),
          skipped: "below_learning_confidence_pattern_gate",
        });
        continue;
      }

      if (!canApplyMore()) {
        period_cap_skipped += 1;
        steps.push({
          recommendation_id: r.id,
          kind: r.kind,
          action: "downgrade_company_model_tier",
          auto_rule: "margin_downgrade_auto",
          idempotency_key: idem,
          confidence: r.confidence,
          ...confFields(downBreak),
          skipped: "global_period_cap",
        });
        continue;
      }

      const effCoolDown = effectiveCooldownMs({
        baseMs: cooldownDownMs,
        globalMultiplier: learning.cooldown_multiplier,
        localSuccessRate: companyDowngradeSuccessRate(learning, cid),
        confidence: downBreak.combined,
      });
      const lastAt = lastDown.get(cid);
      if (lastAt && Date.now() - Date.parse(lastAt) < effCoolDown) {
        cooldown_skipped += 1;
        steps.push({
          recommendation_id: r.id,
          kind: r.kind,
          action: "downgrade_company_model_tier",
          auto_rule: "margin_downgrade_auto",
          idempotency_key: idem,
          confidence: r.confidence,
          ...confFields(downBreak),
          skipped: "cooldown_company_action",
        });
        continue;
      }

      downgrades_attempted += 1;

      try {
        const result = await executeAiRecommendationApplyTrustedAuto({
          rid,
          auto_rule: "margin_downgrade_auto",
          req: {
            action: "downgrade_company_model_tier",
            payload: { company_id: cid },
            recommendation_id: r.id,
            dry_run: false,
            confirmed: false,
            idempotency_key: idem,
          },
        });
        steps.push({
          recommendation_id: r.id,
          kind: r.kind,
          action: "downgrade_company_model_tier",
          auto_rule: "margin_downgrade_auto",
          idempotency_key: idem,
          confidence: r.confidence,
          result,
        });
        bumpAppliedIfNew(result);
        lastDown.set(cid, new Date().toISOString());
        if (recordLearning && !result.idempotent_replay) {
          const row = companyById.get(cid);
          recordDowngradeOutcome(
            learning,
            cid,
            true,
            row
              ? {
                  margin_vs_cost_usd: row.margin_vs_cost_usd,
                  cost_estimate_usd: row.cost_estimate_usd,
                }
              : null,
            period,
          );
        }
      } catch (e) {
        steps.push({
          recommendation_id: r.id,
          kind: r.kind,
          action: "downgrade_company_model_tier",
          auto_rule: "margin_downgrade_auto",
          idempotency_key: idem,
          confidence: r.confidence,
          ...confFields(downBreak),
          error: e instanceof Error ? e.message : String(e),
        });
        if (recordLearning) {
          recordDowngradeOutcome(learning, cid, false, null, period);
        }
      }
    }
  }

  for (const r of recs) {
    if (r.kind !== "block_tool") continue;
    if (throttles_attempted >= maxThrottle) break;
    const tool = r.refs?.tool?.trim();
    if (!tool || tool === "unknown") continue;

    const idem = normIdempotencyAuto(`auto_${period}_throttle_${tool}`);
    if (!idem) continue;

    if (r.severity === "critical") {
      steps.push({
        recommendation_id: r.id,
        kind: r.kind,
        action: "throttle_tool_platform",
        auto_rule: "tool_throttle_auto",
        idempotency_key: idem,
        confidence: r.confidence,
        skipped: "critical_severity_use_manual_block_or_policy",
      });
      continue;
    }

    if (!allowThrottle) {
      steps.push({
        recommendation_id: r.id,
        kind: r.kind,
        action: "throttle_tool_platform",
        auto_rule: "tool_throttle_auto",
        idempotency_key: idem,
        confidence: r.confidence,
        skipped: failSafeActive
          ? "fail_safe_disabled"
          : dry_run
            ? "dry_run"
            : "observe_mode_no_mutation",
      });
      if (failSafeActive) fail_safe_skipped += 1;
      continue;
    }

    const thBreak = autoConfidenceForThrottle(
      learning,
      r.confidence,
      tool,
      strictPatternMinSamples,
      objectiveExec,
    );

    if (thBreak.combined < learning.min_auto_confidence) {
      confidence_threshold_skipped += 1;
      steps.push({
        recommendation_id: r.id,
        kind: r.kind,
        action: "throttle_tool_platform",
        auto_rule: "tool_throttle_auto",
        idempotency_key: idem,
        confidence: r.confidence,
        ...confFields(thBreak),
        skipped: "below_min_auto_confidence",
      });
      continue;
    }

    if (thBreak.strict_pattern && thBreak.learning_confidence < minLearningConfidence) {
      learning_gate_skipped += 1;
      steps.push({
        recommendation_id: r.id,
        kind: r.kind,
        action: "throttle_tool_platform",
        auto_rule: "tool_throttle_auto",
        idempotency_key: idem,
        confidence: r.confidence,
        ...confFields(thBreak),
        skipped: "below_learning_confidence_pattern_gate",
      });
      continue;
    }

    if (activePlatformThrottleForTool(platformGov.throttled_tools, tool)) {
      steps.push({
        recommendation_id: r.id,
        kind: r.kind,
        action: "throttle_tool_platform",
        auto_rule: "tool_throttle_auto",
        idempotency_key: idem,
        confidence: r.confidence,
        ...confFields(thBreak),
        skipped: "already_throttled_active",
      });
      continue;
    }

    if (platformGov.blocked_tools.includes(tool)) {
      steps.push({
        recommendation_id: r.id,
        kind: r.kind,
        action: "throttle_tool_platform",
        auto_rule: "tool_throttle_auto",
        idempotency_key: idem,
        confidence: r.confidence,
        ...confFields(thBreak),
        skipped: "tool_already_platform_blocked",
      });
      continue;
    }

    if (!canApplyMore()) {
      period_cap_skipped += 1;
      steps.push({
        recommendation_id: r.id,
        kind: r.kind,
        action: "throttle_tool_platform",
        auto_rule: "tool_throttle_auto",
        idempotency_key: idem,
        confidence: r.confidence,
        ...confFields(thBreak),
        skipped: "global_period_cap",
      });
      continue;
    }

    const effCoolTh = effectiveCooldownMs({
      baseMs: cooldownThrottleMs,
      globalMultiplier: learning.cooldown_multiplier,
      localSuccessRate: toolThrottleSuccessRate(learning, tool),
      confidence: thBreak.combined,
    });
    const lastT = lastThrottle.get(tool);
    if (lastT && Date.now() - Date.parse(lastT) < effCoolTh) {
      cooldown_skipped += 1;
      steps.push({
        recommendation_id: r.id,
        kind: r.kind,
        action: "throttle_tool_platform",
        auto_rule: "tool_throttle_auto",
        idempotency_key: idem,
        confidence: r.confidence,
        ...confFields(thBreak),
        skipped: "cooldown_tool_action",
      });
      continue;
    }

    throttles_attempted += 1;

    try {
      const result = await executeAiRecommendationApplyTrustedAuto({
        rid,
        auto_rule: "tool_throttle_auto",
        req: {
          action: "throttle_tool_platform",
          payload: { tool, duration_hours: throttleHours },
          recommendation_id: r.id,
          dry_run: false,
          confirmed: false,
          idempotency_key: idem,
        },
      });
      steps.push({
        recommendation_id: r.id,
        kind: r.kind,
        action: "throttle_tool_platform",
        auto_rule: "tool_throttle_auto",
        idempotency_key: idem,
        confidence: r.confidence,
        ...confFields(thBreak),
        result,
      });
      bumpAppliedIfNew(result);
      lastThrottle.set(tool, new Date().toISOString());
      platformGov = await loadPlatformRunnerGovernance();
      if (recordLearning && !result.idempotent_replay) {
        const tr = toolByName.get(tool);
        recordThrottleOutcome(
          learning,
          tool,
          true,
          tr ? { cost_estimate_usd: tr.cost_estimate_usd, runs: tr.runs, period } : { cost_estimate_usd: 0, runs: 0, period },
        );
      }
    } catch (e) {
      steps.push({
        recommendation_id: r.id,
        kind: r.kind,
        action: "throttle_tool_platform",
        auto_rule: "tool_throttle_auto",
        idempotency_key: idem,
        confidence: r.confidence,
        ...confFields(thBreak),
        error: e instanceof Error ? e.message : String(e),
      });
      if (recordLearning) {
        recordThrottleOutcome(learning, tool, false);
      }
    }
  }

  const stepErrors = steps.filter((s) => s.error).length;
  const skippedCount = steps.filter((s) => s.skipped).length;
  const mutationsApplied = steps.filter((s) => s.result && !s.error).length;
  const assist_blocked_downgrades = steps.filter((s) => s.skipped === "assist_mode_downgrade_disabled").length;

  let consecutive_errors = aes?.consecutive_errors ?? 0;
  let disabled_until =
    aes?.disabled_until && Date.parse(aes.disabled_until) > Date.now() ? aes.disabled_until : null;

  const shouldMutatePersistedState = !dry_run && drift_mode !== "observe";

  if (shouldMutatePersistedState) {
    if (stepErrors > 0) {
      consecutive_errors += 1;
    } else {
      consecutive_errors = 0;
    }
    if (consecutive_errors >= errorStreakMax) {
      disabled_until = new Date(Date.now() + disableCooldownHours * 3_600_000).toISOString();
      consecutive_errors = 0;
    }
  }

  const at = new Date().toISOString();

  const nextState: PlatformAutoExecutionState = {
    consecutive_errors,
    disabled_until,
    last_run_rid: rid,
    last_run_at: at,
    last_run_step_errors: stepErrors,
  };

  const persistedState: PlatformAutoExecutionState = shouldMutatePersistedState
    ? nextState
    : aes ?? {
        consecutive_errors: 0,
        disabled_until: null,
        last_run_rid: null,
        last_run_at: null,
        last_run_step_errors: 0,
      };

  const finalLearning = recomputeAdaptiveDerived(learning, {
    lastRunStepErrors: stepErrors,
    failSafeWasActive: failSafeActive,
    objective_min_auto_confidence_delta: objectiveExec.min_auto_confidence_delta,
    objective_cooldown_multiplier_delta: objectiveExec.cooldown_multiplier_delta,
  });

  if (shouldMutatePersistedState) {
    recordStrategyPerformance(
      finalLearning,
      period,
      objectiveExec.strategy_mode,
      objectiveScore,
      {
        margin_gap_base: objectiveResolved.margin_gap_base,
        growth_gap_base: objectiveResolved.growth_gap_base,
      },
    );
    syncObjectiveCheckpoint(finalLearning, overview, objectiveScore);
  }

  const demoDownMs = effectiveCooldownMs({
    baseMs: cooldownDownMs,
    globalMultiplier: finalLearning.cooldown_multiplier,
    localSuccessRate: null,
    confidence: 0.62,
  });
  const demoThMs = effectiveCooldownMs({
    baseMs: cooldownThrottleMs,
    globalMultiplier: finalLearning.cooldown_multiplier,
    localSuccessRate: null,
    confidence: 0.62,
  });

  const adaptiveSnap: PlatformAutoExecutionAdaptiveSnapshot = {
    requested_drift: drift_mode,
    effective_drift,
    cooldown_multiplier: finalLearning.cooldown_multiplier,
    min_auto_confidence: finalLearning.min_auto_confidence,
    effective_cooldown_downgrade_ms: demoDownMs,
    effective_cooldown_throttle_ms: demoThMs,
    global_downgrade_success_rate: successRate(
      finalLearning.global.downgrade.attempts,
      finalLearning.global.downgrade.successes,
    ),
    global_throttle_success_rate: successRate(
      finalLearning.global.throttle.attempts,
      finalLearning.global.throttle.successes,
    ),
    objective_score: objectiveScore,
    objective_stress: objectiveExec.stress,
    margin_gap_stress: objectiveExec.margin_gap_stress,
    growth_gap_stress: objectiveExec.growth_gap_stress,
    strategy_mode: objectiveExec.strategy_mode,
  };

  const monitoring: PlatformAutoExecutionSummary = {
    rid,
    at,
    period,
    mode: effective_drift,
    observe_only,
    fail_safe_active: isAutoExecutionFailSafeActive(persistedState),
    adaptive: adaptiveSnap,
    counts: {
      mutations_applied: mutationsApplied,
      skipped: skippedCount,
      errors: stepErrors,
      cooldown_skipped,
      period_cap_skipped,
      fail_safe_skipped,
      assist_blocked_downgrades,
      confidence_threshold_skipped,
      learning_gate_skipped,
    },
    limits: {
      max_actions_per_period: maxActionsPeriod,
      auto_applies_in_period_at_start: periodApplyCountStart,
      cooldown_downgrade_ms: cooldownDownMs,
      cooldown_throttle_ms: cooldownThrottleMs,
      error_streak_max: errorStreakMax,
      disable_cooldown_hours: disableCooldownHours,
    },
  };

  try {
    const fresh = await loadPlatformRunnerGovernance();
    await savePlatformRunnerGovernance({
      ...fresh,
      auto_execution_state: persistedState,
      auto_execution_last_summary: monitoring,
      auto_adaptive_learning: finalLearning,
    });
  } catch {
    /* persistence must not fail the cron response */
  }

  return {
    rid,
    period,
    drift_mode,
    effective_mode: effective_drift,
    dry_run,
    observe_only,
    fail_safe: {
      active: isAutoExecutionFailSafeActive(persistedState),
      disabled_until: persistedState.disabled_until,
      consecutive_errors_before: consecutive_before,
    },
    downgrades_attempted,
    throttles_attempted,
    monitoring,
    steps,
  };
}

export type { AiGovernanceAutoDriftMode } from "@/lib/ai/runnerGovernance";
