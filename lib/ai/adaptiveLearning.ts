import "server-only";

import type { ObjectiveCheckpoint } from "@/lib/ai/businessObjective";
import {
  readObjectiveWeightsFromEnv,
  resolvePlatformObjective,
  resolveStrategyOverrideLayer,
  type BusinessObjectiveWeights,
  type ObjectiveExecutionContext,
  type StrategyMode,
  type StrategyOverrideLayer,
} from "@/lib/ai/businessObjective";
import type { AiDashboardRecommendation } from "@/lib/ai/dashboardEngine";
import type { PlatformAiBillingOverview } from "@/lib/ai/usageOverview";
import type { AiGovernanceAutoDriftMode } from "@/lib/ai/runnerGovernance";

export const ADAPTIVE_LEARNING_VERSION = 3 as const;

const MARGIN_DELTA_EPS = 0.008;
const COST_DELTA_EPS = 0.02;

export type AdaptiveActionKey = "downgrade" | "throttle";

/** Aggregated margin movement after downgrade actions (period-over-period). */
export type GlobalMarginImpactStats = {
  n_margin_observations: number;
  sum_margin_delta: number;
  n_margin_positive: number;
  n_margin_negative: number;
};

/** Aggregated tool cost movement after throttle actions (period-over-period). */
export type GlobalToolCostImpactStats = {
  n_cost_observations: number;
  sum_cost_delta: number;
  n_cost_reduced: number;
  n_cost_increased: number;
};

/** Per-company learning (downgrade / margin path). */
export type AdaptivePerCompanyStats = {
  downgrade_attempts: number;
  downgrade_successes: number;
  margin_signal_ema: number | null;
  last_margin_vs_cost_usd: number | null;
  last_cost_estimate_usd: number | null;
  last_period_label: string | null;
  updated_at: string | null;
};

/** Per-tool learning (platform throttle path). */
export type AdaptivePerToolStats = {
  throttle_attempts: number;
  throttle_successes: number;
  last_tool_cost_usd: number | null;
  last_tool_runs: number | null;
  last_period_label: string | null;
  updated_at: string | null;
};

/** Rolling objective score while each strategy mode was active (telemetry). */
export type StrategyModePerformanceBucket = {
  samples: number;
  score_ema: number;
};

export type StrategyTimelineSource = "executor" | "dashboard";

export type StrategyTimelineEntry = {
  at: string;
  period: string;
  mode: StrategyMode;
  source: StrategyTimelineSource;
  margin_gap_base?: number;
  growth_gap_base?: number;
  score?: number;
};

export type StrategyStatePersisted = {
  active_mode: StrategyMode;
  last_period: string | null;
  switch_count: number;
  by_mode: Partial<Record<StrategyMode, StrategyModePerformanceBucket>>;
  /** Newest first; max 50 entries. */
  timeline: StrategyTimelineEntry[];
};

export type PlatformAdaptiveLearning = {
  version: number;
  global: Record<AdaptiveActionKey, { attempts: number; successes: number }>;
  global_margin_impact: GlobalMarginImpactStats;
  global_tool_cost_impact: GlobalToolCostImpactStats;
  objective_checkpoint: ObjectiveCheckpoint | null;
  strategy_state: StrategyStatePersisted;
  by_company: Record<string, AdaptivePerCompanyStats>;
  by_tool: Record<string, AdaptivePerToolStats>;
  adaptive_drift: AiGovernanceAutoDriftMode;
  cooldown_multiplier: number;
  min_auto_confidence: number;
  updated_at: string | null;
};

function emptyMarginImpact(): GlobalMarginImpactStats {
  return {
    n_margin_observations: 0,
    sum_margin_delta: 0,
    n_margin_positive: 0,
    n_margin_negative: 0,
  };
}

function emptyCostImpact(): GlobalToolCostImpactStats {
  return {
    n_cost_observations: 0,
    sum_cost_delta: 0,
    n_cost_reduced: 0,
    n_cost_increased: 0,
  };
}

const STRATEGY_TIMELINE_MAX = 50;

function defaultStrategyState(): StrategyStatePersisted {
  return {
    active_mode: "balance",
    last_period: null,
    switch_count: 0,
    by_mode: {},
    timeline: [],
  };
}

export function defaultAdaptiveLearning(): PlatformAdaptiveLearning {
  const now = new Date().toISOString();
  return {
    version: ADAPTIVE_LEARNING_VERSION,
    global: {
      downgrade: { attempts: 0, successes: 0 },
      throttle: { attempts: 0, successes: 0 },
    },
    global_margin_impact: emptyMarginImpact(),
    global_tool_cost_impact: emptyCostImpact(),
    objective_checkpoint: null,
    strategy_state: defaultStrategyState(),
    by_company: {},
    by_tool: {},
    adaptive_drift: "auto",
    cooldown_multiplier: 1,
    min_auto_confidence: 0.42,
    updated_at: now,
  };
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

function parseMarginImpact(raw: unknown): GlobalMarginImpactStats {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyMarginImpact();
  const o = raw as Record<string, unknown>;
  return {
    n_margin_observations: Math.max(0, Math.floor(num(o.n_margin_observations))),
    sum_margin_delta: num(o.sum_margin_delta, 0),
    n_margin_positive: Math.max(0, Math.floor(num(o.n_margin_positive))),
    n_margin_negative: Math.max(0, Math.floor(num(o.n_margin_negative))),
  };
}

function parseCostImpact(raw: unknown): GlobalToolCostImpactStats {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyCostImpact();
  const o = raw as Record<string, unknown>;
  return {
    n_cost_observations: Math.max(0, Math.floor(num(o.n_cost_observations))),
    sum_cost_delta: num(o.sum_cost_delta, 0),
    n_cost_reduced: Math.max(0, Math.floor(num(o.n_cost_reduced))),
    n_cost_increased: Math.max(0, Math.floor(num(o.n_cost_increased))),
  };
}

function parseObjectiveCheckpoint(raw: unknown): ObjectiveCheckpoint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const period = typeof o.period === "string" ? o.period.trim() : "";
  if (!period) return null;
  const os = o.objective_score;
  const objective_score =
    typeof os === "number" && Number.isFinite(os) ? clamp01(os) : 0.5;
  return {
    period,
    margin_usd:
      typeof o.margin_usd === "number" && Number.isFinite(o.margin_usd) ? o.margin_usd : null,
    list_mrr_usd:
      typeof o.list_mrr_usd === "number" && Number.isFinite(o.list_mrr_usd) ? o.list_mrr_usd : null,
    total_runs: Math.max(0, Math.floor(num(o.total_runs))),
    objective_score,
  };
}

function parseStrategyMode(v: unknown): StrategyMode | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "profit" || s === "growth" || s === "balance") return s;
  return null;
}

function parseStrategyState(raw: unknown): StrategyStatePersisted {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaultStrategyState();
  const o = raw as Record<string, unknown>;
  const active = parseStrategyMode(o.active_mode) ?? "balance";
  const last_period = typeof o.last_period === "string" ? o.last_period.trim() : null;
  const switch_count = Math.max(0, Math.floor(num(o.switch_count)));
  const bm = o.by_mode;
  const by_mode: Partial<Record<StrategyMode, StrategyModePerformanceBucket>> = {};
  if (bm && typeof bm === "object" && !Array.isArray(bm)) {
    for (const key of ["profit", "growth", "balance"] as StrategyMode[]) {
      const entry = (bm as Record<string, unknown>)[key];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const e = entry as Record<string, unknown>;
      const samples = Math.max(0, Math.floor(num(e.samples)));
      const em = e.score_ema;
      const score_ema =
        typeof em === "number" && Number.isFinite(em) ? Math.min(1, Math.max(0, em)) : 0;
      by_mode[key] = { samples, score_ema };
    }
  }
  const tl = o.timeline;
  const timeline: StrategyTimelineEntry[] = [];
  if (Array.isArray(tl)) {
    for (const item of tl) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const e = item as Record<string, unknown>;
      const mode = parseStrategyMode(e.mode);
      if (!mode) continue;
      const at = typeof e.at === "string" ? e.at.trim() : "";
      const period = typeof e.period === "string" ? e.period.trim() : "";
      if (!at || !period) continue;
      const src = e.source === "dashboard" ? "dashboard" : "executor";
      const mgb = e.margin_gap_base;
      const ggb = e.growth_gap_base;
      const sc = e.score;
      timeline.push({
        at,
        period,
        mode,
        source: src,
        ...(typeof mgb === "number" && Number.isFinite(mgb) ? { margin_gap_base: mgb } : {}),
        ...(typeof ggb === "number" && Number.isFinite(ggb) ? { growth_gap_base: ggb } : {}),
        ...(typeof sc === "number" && Number.isFinite(sc) ? { score: Math.min(1, Math.max(0, sc)) } : {}),
      });
    }
  }
  return {
    active_mode: active,
    last_period: last_period || null,
    switch_count,
    by_mode,
    timeline: timeline.slice(0, STRATEGY_TIMELINE_MAX),
  };
}

function parsePerCompany(raw: unknown): AdaptivePerCompanyStats | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    downgrade_attempts: Math.max(0, Math.floor(num(o.downgrade_attempts))),
    downgrade_successes: Math.max(0, Math.floor(num(o.downgrade_successes))),
    margin_signal_ema: typeof o.margin_signal_ema === "number" && Number.isFinite(o.margin_signal_ema) ? o.margin_signal_ema : null,
    last_margin_vs_cost_usd:
      typeof o.last_margin_vs_cost_usd === "number" && Number.isFinite(o.last_margin_vs_cost_usd)
        ? o.last_margin_vs_cost_usd
        : null,
    last_cost_estimate_usd:
      typeof o.last_cost_estimate_usd === "number" && Number.isFinite(o.last_cost_estimate_usd)
        ? o.last_cost_estimate_usd
        : null,
    last_period_label: typeof o.last_period_label === "string" ? o.last_period_label : null,
    updated_at: typeof o.updated_at === "string" ? o.updated_at : null,
  };
}

function parsePerTool(raw: unknown): AdaptivePerToolStats | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    throttle_attempts: Math.max(0, Math.floor(num(o.throttle_attempts))),
    throttle_successes: Math.max(0, Math.floor(num(o.throttle_successes))),
    last_tool_cost_usd:
      typeof o.last_tool_cost_usd === "number" && Number.isFinite(o.last_tool_cost_usd)
        ? o.last_tool_cost_usd
        : null,
    last_tool_runs: typeof o.last_tool_runs === "number" && Number.isFinite(o.last_tool_runs) ? o.last_tool_runs : null,
    last_period_label: typeof o.last_period_label === "string" ? o.last_period_label : null,
    updated_at: typeof o.updated_at === "string" ? o.updated_at : null,
  };
}

export function parseAdaptiveLearning(raw: unknown): PlatformAdaptiveLearning | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const ver = o.version != null ? Number(o.version) : 1;
  if (ver !== 1 && ver !== 2 && ver !== 3 && ver !== ADAPTIVE_LEARNING_VERSION) return undefined;

  const g = o.global;
  const global: PlatformAdaptiveLearning["global"] = {
    downgrade: { attempts: 0, successes: 0 },
    throttle: { attempts: 0, successes: 0 },
  };
  if (g && typeof g === "object" && !Array.isArray(g)) {
    const gg = g as Record<string, unknown>;
    const d = gg.downgrade;
    const t = gg.throttle;
    if (d && typeof d === "object" && !Array.isArray(d)) {
      const dd = d as Record<string, unknown>;
      global.downgrade = {
        attempts: Math.max(0, Math.floor(num(dd.attempts))),
        successes: Math.max(0, Math.floor(num(dd.successes))),
      };
    }
    if (t && typeof t === "object" && !Array.isArray(t)) {
      const tt = t as Record<string, unknown>;
      global.throttle = {
        attempts: Math.max(0, Math.floor(num(tt.attempts))),
        successes: Math.max(0, Math.floor(num(tt.successes))),
      };
    }
  }

  const by_company: Record<string, AdaptivePerCompanyStats> = {};
  const bc = o.by_company;
  if (bc && typeof bc === "object" && !Array.isArray(bc)) {
    for (const [k, v] of Object.entries(bc)) {
      const p = parsePerCompany(v);
      if (p) by_company[k] = p;
    }
  }

  const by_tool: Record<string, AdaptivePerToolStats> = {};
  const bt = o.by_tool;
  if (bt && typeof bt === "object" && !Array.isArray(bt)) {
    for (const [k, v] of Object.entries(bt)) {
      const p = parsePerTool(v);
      if (p) by_tool[k] = p;
    }
  }

  const driftRaw = typeof o.adaptive_drift === "string" ? o.adaptive_drift.toLowerCase() : "";
  const adaptive_drift: AiGovernanceAutoDriftMode =
    driftRaw === "observe" || driftRaw === "assist" || driftRaw === "auto" ? driftRaw : "auto";
  const cooldown_multiplier = Math.min(2.75, Math.max(0.45, num(o.cooldown_multiplier, 1) || 1));
  const min_auto_confidence = Math.min(0.9, Math.max(0.25, num(o.min_auto_confidence, 0.42) || 0.42));

  return {
    version: ADAPTIVE_LEARNING_VERSION,
    global,
    global_margin_impact: parseMarginImpact(o.global_margin_impact),
    global_tool_cost_impact: parseCostImpact(o.global_tool_cost_impact),
    objective_checkpoint: parseObjectiveCheckpoint(o.objective_checkpoint),
    strategy_state: parseStrategyState(o.strategy_state),
    by_company,
    by_tool,
    adaptive_drift,
    cooldown_multiplier,
    min_auto_confidence,
    updated_at: typeof o.updated_at === "string" ? o.updated_at : null,
  };
}

export function mergeAdaptiveLearning(
  prev: PlatformAdaptiveLearning | undefined,
  next: Partial<PlatformAdaptiveLearning> | undefined,
): PlatformAdaptiveLearning | undefined {
  if (!next) return prev;
  const base = prev ?? defaultAdaptiveLearning();
  return {
    version: ADAPTIVE_LEARNING_VERSION,
    global: {
      downgrade: next.global?.downgrade ?? base.global.downgrade,
      throttle: next.global?.throttle ?? base.global.throttle,
    },
    global_margin_impact: next.global_margin_impact ?? base.global_margin_impact,
    global_tool_cost_impact: next.global_tool_cost_impact ?? base.global_tool_cost_impact,
    objective_checkpoint:
      next.objective_checkpoint !== undefined ? next.objective_checkpoint : base.objective_checkpoint,
    strategy_state: next.strategy_state !== undefined ? next.strategy_state : base.strategy_state,
    by_company: { ...base.by_company, ...next.by_company },
    by_tool: { ...base.by_tool, ...next.by_tool },
    adaptive_drift: next.adaptive_drift ?? base.adaptive_drift,
    cooldown_multiplier: next.cooldown_multiplier ?? base.cooldown_multiplier,
    min_auto_confidence: next.min_auto_confidence ?? base.min_auto_confidence,
    updated_at: next.updated_at ?? base.updated_at,
  };
}

export function successRate(attempts: number, successes: number): number | null {
  if (attempts <= 0) return null;
  return Math.min(1, Math.max(0, successes / attempts));
}

export function mergeDriftWithAdaptive(
  requested: AiGovernanceAutoDriftMode,
  adaptive: AiGovernanceAutoDriftMode,
): AiGovernanceAutoDriftMode {
  const rank: Record<AiGovernanceAutoDriftMode, number> = { observe: 0, assist: 1, auto: 2 };
  return rank[requested] <= rank[adaptive] ? requested : adaptive;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * How much we trust empirical rates from sample size alone (0 = ignore history, 1 = full trust).
 */
export function learningCertaintyFromSampleSize(n: number): number {
  if (n <= 0) return 0;
  return clamp01(1 - Math.exp(-n / 9));
}

function marginImprovementFraction(imp: GlobalMarginImpactStats): number | null {
  const denom = imp.n_margin_positive + imp.n_margin_negative;
  if (denom < 1) return null;
  return imp.n_margin_positive / denom;
}

function costReductionFraction(imp: GlobalToolCostImpactStats): number | null {
  const denom = imp.n_cost_reduced + imp.n_cost_increased;
  if (denom < 1) return null;
  return imp.n_cost_reduced / denom;
}

function empiricalMultiplierDowngrade(learning: PlatformAdaptiveLearning, companyId: string): number {
  let m = 1;
  const imp = learning.global_margin_impact;
  const fr = marginImprovementFraction(imp);
  if (fr != null && imp.n_margin_observations >= 4) {
    m *= 0.84 + 0.32 * clamp01((fr - 0.42) / 0.38);
  }
  const st = learning.by_company[companyId];
  if (st?.margin_signal_ema != null && (st.downgrade_attempts ?? 0) >= 2) {
    const ema = st.margin_signal_ema;
    m *= 0.88 + 0.24 * clamp01(0.5 + Math.sign(ema) * Math.min(0.5, Math.abs(ema) / 45));
  }
  return clamp01(m);
}

function empiricalMultiplierThrottle(learning: PlatformAdaptiveLearning, _tool: string): number {
  let m = 1;
  const imp = learning.global_tool_cost_impact;
  const fr = costReductionFraction(imp);
  if (fr != null && imp.n_cost_observations >= 3) {
    m *= 0.86 + 0.3 * clamp01((fr - 0.42) / 0.38);
  }
  return clamp01(m);
}

/** How well historical outcomes for this action type align with the business objective (margin / cost). */
function actionObjectiveImpactMult(learning: PlatformAdaptiveLearning, kind: AdaptiveActionKey): number {
  if (kind === "downgrade") {
    const fr = marginImprovementFraction(learning.global_margin_impact);
    if (fr == null) return 0.94;
    return clamp01(0.86 + 0.22 * fr);
  }
  const fr = costReductionFraction(learning.global_tool_cost_impact);
  if (fr == null) return 0.94;
  return clamp01(0.86 + 0.22 * fr);
}

export type AutoConfidenceBreakdown = {
  heuristic: number;
  combined: number;
  learning_confidence: number;
  strict_pattern: boolean;
};

export function patternSampleStrengthDowngrade(learning: PlatformAdaptiveLearning, companyId: string): number {
  const g = learning.global_margin_impact.n_margin_observations;
  const n = learning.by_company[companyId]?.downgrade_attempts ?? 0;
  return g + n;
}

export function patternSampleStrengthThrottle(learning: PlatformAdaptiveLearning, tool: string): number {
  const g = learning.global_tool_cost_impact.n_cost_observations;
  const n = learning.by_tool[tool]?.throttle_attempts ?? 0;
  return g + n;
}

export function autoConfidenceForDowngrade(
  learning: PlatformAdaptiveLearning,
  heuristic: number,
  companyId: string,
  strictMinSamples: number,
  objective?: Pick<
    ObjectiveExecutionContext,
    "execution_confidence_mult" | "downgrade_gap_scale"
  > | null,
): AutoConfidenceBreakdown {
  const strength = patternSampleStrengthDowngrade(learning, companyId);
  const lc = learningCertaintyFromSampleSize(Math.max(strength, learning.global.downgrade.attempts));
  const emp = empiricalMultiplierDowngrade(learning, companyId);
  const actionM = actionObjectiveImpactMult(learning, "downgrade");
  const execM = objective?.execution_confidence_mult ?? 1;
  const gapM = objective?.downgrade_gap_scale ?? 1;
  const combined = clamp01(heuristic * emp * (0.78 + 0.22 * lc) * actionM * execM * gapM);
  return {
    heuristic,
    combined,
    learning_confidence: lc,
    strict_pattern: strength >= strictMinSamples,
  };
}

export function autoConfidenceForThrottle(
  learning: PlatformAdaptiveLearning,
  heuristic: number,
  tool: string,
  strictMinSamples: number,
  objective?: Pick<ObjectiveExecutionContext, "execution_confidence_mult"> | null,
): AutoConfidenceBreakdown {
  const strength = patternSampleStrengthThrottle(learning, tool);
  const lc = learningCertaintyFromSampleSize(Math.max(strength, learning.global.throttle.attempts));
  const emp = empiricalMultiplierThrottle(learning, tool);
  const actionM = actionObjectiveImpactMult(learning, "throttle");
  const execM = objective?.execution_confidence_mult ?? 1;
  const combined = clamp01(heuristic * emp * (0.78 + 0.22 * lc) * actionM * execM);
  return {
    heuristic,
    combined,
    learning_confidence: lc,
    strict_pattern: strength >= strictMinSamples,
  };
}

/**
 * Period roll-forward: blend margin delta for companies with prior downgrade history.
 */
export function applyMarginPeriodRollforward(
  learning: PlatformAdaptiveLearning,
  overview: PlatformAiBillingOverview,
): void {
  const companies = new Map(overview.top_companies.map((c) => [c.company_id, c]));
  const imp = learning.global_margin_impact;

  for (const [cid, st] of Object.entries(learning.by_company)) {
    if (st.last_period_label == null || st.last_margin_vs_cost_usd == null) continue;
    if (st.last_period_label >= overview.period) continue;
    const row = companies.get(cid);
    if (!row || row.margin_vs_cost_usd == null) continue;
    const delta = row.margin_vs_cost_usd - st.last_margin_vs_cost_usd;
    st.margin_signal_ema =
      st.margin_signal_ema == null ? delta : st.margin_signal_ema * 0.62 + delta * 0.38;
    st.last_period_label = overview.period;
    st.last_margin_vs_cost_usd = row.margin_vs_cost_usd;
    st.last_cost_estimate_usd = row.cost_estimate_usd;
    st.updated_at = new Date().toISOString();

    if (st.downgrade_successes > 0) {
      imp.n_margin_observations += 1;
      imp.sum_margin_delta += delta;
      if (delta > MARGIN_DELTA_EPS) imp.n_margin_positive += 1;
      else if (delta < -MARGIN_DELTA_EPS) imp.n_margin_negative += 1;
    }
  }
}

/**
 * Period roll-forward: tool cost delta after throttle history.
 */
export function applyToolCostRollforward(learning: PlatformAdaptiveLearning, overview: PlatformAiBillingOverview): void {
  const tools = new Map(overview.by_tool.map((t) => [t.tool, t]));
  const imp = learning.global_tool_cost_impact;

  for (const [tool, st] of Object.entries(learning.by_tool)) {
    if (st.last_period_label == null || st.last_tool_cost_usd == null) continue;
    if (st.last_period_label >= overview.period) continue;
    const row = tools.get(tool);
    if (!row) continue;
    const delta = row.cost_estimate_usd - st.last_tool_cost_usd;
    st.last_period_label = overview.period;
    st.last_tool_cost_usd = row.cost_estimate_usd;
    st.last_tool_runs = row.runs;
    st.updated_at = new Date().toISOString();

    if (st.throttle_successes > 0) {
      imp.n_cost_observations += 1;
      imp.sum_cost_delta += delta;
      if (delta < -COST_DELTA_EPS) imp.n_cost_reduced += 1;
      else if (delta > COST_DELTA_EPS) imp.n_cost_increased += 1;
    }
  }
}

function ensureCompany(learning: PlatformAdaptiveLearning, cid: string): AdaptivePerCompanyStats {
  learning.by_company[cid] ??= {
    downgrade_attempts: 0,
    downgrade_successes: 0,
    margin_signal_ema: null,
    last_margin_vs_cost_usd: null,
    last_cost_estimate_usd: null,
    last_period_label: null,
    updated_at: null,
  };
  return learning.by_company[cid];
}

function ensureTool(learning: PlatformAdaptiveLearning, tool: string): AdaptivePerToolStats {
  learning.by_tool[tool] ??= {
    throttle_attempts: 0,
    throttle_successes: 0,
    last_tool_cost_usd: null,
    last_tool_runs: null,
    last_period_label: null,
    updated_at: null,
  };
  return learning.by_tool[tool];
}

export function syncObjectiveCheckpoint(
  learning: PlatformAdaptiveLearning,
  overview: PlatformAiBillingOverview,
  score: number,
): void {
  learning.objective_checkpoint = {
    period: overview.period,
    margin_usd: overview.totals.margin_usd,
    list_mrr_usd: overview.totals.total_list_mrr_usd,
    total_runs: overview.totals.total_runs,
    objective_score: Math.min(1, Math.max(0, score)),
  };
  learning.updated_at = new Date().toISOString();
}

/** Prepends one audit row (newest first), capped at 50 entries. */
export function appendStrategyTimelineEntry(
  learning: PlatformAdaptiveLearning,
  entry: {
    period: string;
    mode: StrategyMode;
    source: StrategyTimelineSource;
    score?: number;
    margin_gap_base?: number;
    growth_gap_base?: number;
    at?: string;
  },
): void {
  const st = learning.strategy_state ?? defaultStrategyState();
  learning.strategy_state = st;
  const at = typeof entry.at === "string" && entry.at.trim() ? entry.at.trim() : new Date().toISOString();
  const full: StrategyTimelineEntry = {
    at,
    period: entry.period,
    mode: entry.mode,
    source: entry.source,
    ...(typeof entry.margin_gap_base === "number" && Number.isFinite(entry.margin_gap_base)
      ? { margin_gap_base: entry.margin_gap_base }
      : {}),
    ...(typeof entry.growth_gap_base === "number" && Number.isFinite(entry.growth_gap_base)
      ? { growth_gap_base: entry.growth_gap_base }
      : {}),
    ...(typeof entry.score === "number" && Number.isFinite(entry.score)
      ? { score: Math.min(1, Math.max(0, entry.score)) }
      : {}),
  };
  st.timeline = [full, ...(st.timeline ?? [])].slice(0, STRATEGY_TIMELINE_MAX);
  learning.updated_at = new Date().toISOString();
}

/**
 * Updates persisted strategy telemetry after a mutating executor run (mode switches + per-mode score EMA).
 */
export function recordStrategyPerformance(
  learning: PlatformAdaptiveLearning,
  period: string,
  mode: StrategyMode,
  objectiveScore: number,
  opts?: {
    margin_gap_base?: number;
    growth_gap_base?: number;
  },
): void {
  const st = learning.strategy_state ?? defaultStrategyState();
  learning.strategy_state = st;
  const score = Math.min(1, Math.max(0, objectiveScore));
  if (st.active_mode !== mode) {
    appendStrategyTimelineEntry(learning, {
      period,
      mode,
      source: "executor",
      score,
      margin_gap_base: opts?.margin_gap_base,
      growth_gap_base: opts?.growth_gap_base,
    });
    st.switch_count += 1;
    st.active_mode = mode;
  }
  const prev = st.by_mode[mode];
  const samples = (prev?.samples ?? 0) + 1;
  const ema =
    samples <= 1 ? score : (prev?.score_ema ?? score) * 0.82 + score * 0.18;
  st.by_mode[mode] = { samples, score_ema: Math.min(1, Math.max(0, ema)) };
  st.last_period = period;
  learning.updated_at = new Date().toISOString();
}

export function recordDowngradeOutcome(
  learning: PlatformAdaptiveLearning,
  companyId: string,
  ok: boolean,
  overviewRow: { margin_vs_cost_usd: number | null; cost_estimate_usd: number } | null,
  period: string,
): void {
  const g = learning.global.downgrade;
  const st = ensureCompany(learning, companyId);
  const now = new Date().toISOString();
  st.downgrade_attempts += 1;
  if (ok) st.downgrade_successes += 1;
  g.attempts += 1;
  if (ok) g.successes += 1;
  st.updated_at = now;
  learning.updated_at = now;
  if (ok && overviewRow?.margin_vs_cost_usd != null) {
    st.last_margin_vs_cost_usd = overviewRow.margin_vs_cost_usd;
    st.last_cost_estimate_usd = overviewRow.cost_estimate_usd;
    st.last_period_label = period;
  }
}

export function recordThrottleOutcome(
  learning: PlatformAdaptiveLearning,
  tool: string,
  ok: boolean,
  toolRow?: { cost_estimate_usd: number; runs: number; period: string } | null,
): void {
  const g = learning.global.throttle;
  const st = ensureTool(learning, tool);
  const now = new Date().toISOString();
  st.throttle_attempts += 1;
  if (ok) st.throttle_successes += 1;
  g.attempts += 1;
  if (ok) g.successes += 1;
  st.updated_at = now;
  learning.updated_at = now;
  if (ok && toolRow) {
    st.last_tool_cost_usd = toolRow.cost_estimate_usd;
    st.last_tool_runs = toolRow.runs;
    st.last_period_label = toolRow.period;
  }
}

export type RecomputeAdaptiveOpts = {
  lastRunStepErrors: number;
  failSafeWasActive: boolean;
  objective_min_auto_confidence_delta?: number;
  objective_cooldown_multiplier_delta?: number;
};

export function recomputeAdaptiveDerived(
  learning: PlatformAdaptiveLearning,
  opts: RecomputeAdaptiveOpts,
): PlatformAdaptiveLearning {
  const rd = successRate(learning.global.downgrade.attempts, learning.global.downgrade.successes);
  const rt = successRate(learning.global.throttle.attempts, learning.global.throttle.successes);
  const attempts = learning.global.downgrade.attempts + learning.global.throttle.attempts;

  let adaptive_drift: AiGovernanceAutoDriftMode = "auto";
  if (attempts < 4) {
    adaptive_drift = "assist";
  }
  if (rd != null && learning.global.downgrade.attempts >= 4 && rd < 0.45) {
    adaptive_drift = "assist";
  }
  if (rd != null && learning.global.downgrade.attempts >= 7 && rd < 0.32) {
    adaptive_drift = "observe";
  }
  if (rt != null && learning.global.throttle.attempts >= 5 && rt < 0.4) {
    adaptive_drift = adaptive_drift === "auto" ? "assist" : adaptive_drift;
  }

  const mf = marginImprovementFraction(learning.global_margin_impact);
  if (
    mf != null &&
    learning.global_margin_impact.n_margin_observations >= 5 &&
    mf < 0.38
  ) {
    adaptive_drift = mergeDriftWithAdaptive("assist", adaptive_drift);
  }

  if (opts.lastRunStepErrors > 0 || opts.failSafeWasActive) {
    adaptive_drift = mergeDriftWithAdaptive("observe", adaptive_drift);
  }

  const rdSafe = rd ?? 0.72;
  const rtSafe = rt ?? 0.72;
  const blended = (rdSafe + rtSafe) / 2;
  let cooldown_multiplier = 0.92 + (1 - blended) * 1.15;
  cooldown_multiplier = Math.min(2.65, Math.max(0.48, cooldown_multiplier));

  let min_auto_confidence = 0.38 + (1 - blended) * 0.38;
  if (learning.global.downgrade.attempts >= 6 && rd != null && rd < 0.5) {
    min_auto_confidence += 0.08;
  }
  if (mf != null && learning.global_margin_impact.n_margin_observations >= 6 && mf < 0.45) {
    min_auto_confidence += 0.06;
  }
  min_auto_confidence = Math.min(0.88, Math.max(0.28, min_auto_confidence));

  if (opts.objective_cooldown_multiplier_delta != null) {
    cooldown_multiplier = Math.min(
      2.65,
      Math.max(0.48, cooldown_multiplier + opts.objective_cooldown_multiplier_delta),
    );
  }
  if (opts.objective_min_auto_confidence_delta != null) {
    min_auto_confidence = Math.min(
      0.88,
      Math.max(0.28, min_auto_confidence + opts.objective_min_auto_confidence_delta),
    );
  }

  return {
    ...learning,
    adaptive_drift,
    cooldown_multiplier,
    min_auto_confidence,
    updated_at: new Date().toISOString(),
  };
}

export function companyDowngradeSuccessRate(learning: PlatformAdaptiveLearning, companyId: string): number | null {
  const st = learning.by_company[companyId];
  if (!st) return null;
  return successRate(st.downgrade_attempts, st.downgrade_successes);
}

export function toolThrottleSuccessRate(learning: PlatformAdaptiveLearning, tool: string): number | null {
  const st = learning.by_tool[tool];
  if (!st) return null;
  return successRate(st.throttle_attempts, st.throttle_successes);
}

export function effectiveCooldownMs(params: {
  baseMs: number;
  globalMultiplier: number;
  localSuccessRate: number | null;
  confidence: number;
}): number {
  const { baseMs, globalMultiplier, localSuccessRate, confidence } = params;
  const rate = localSuccessRate == null ? 0.68 : clamp01(localSuccessRate);
  const localStretch = 1 + (1 - rate) * 0.55;
  const confStretch = clamp01(1.15 - confidence * 0.35);
  const ms = baseMs * globalMultiplier * localStretch * confStretch;
  return Math.max(15 * 60_000, Math.min(45 * 24 * 3_600_000, Math.round(ms)));
}

/** Merge learning into recommendations for superadmin UI (read-only enrichment). */
export function enrichRecommendationsWithLearning(
  learning: PlatformAdaptiveLearning,
  recs: AiDashboardRecommendation[],
  strictMinSamples: number,
  options?: {
    overview?: PlatformAiBillingOverview;
    weights?: BusinessObjectiveWeights;
    strategy_override_layer?: StrategyOverrideLayer;
  },
): AiDashboardRecommendation[] {
  const weights = options?.weights ?? readObjectiveWeightsFromEnv();
  const objectiveExec =
    options?.overview != null
      ? resolvePlatformObjective(options.overview, learning.objective_checkpoint ?? null, {
          baseWeights: weights,
          previous_strategy_mode: learning.strategy_state?.active_mode ?? null,
          strategy_override_layer:
            options.strategy_override_layer ??
            resolveStrategyOverrideLayer(undefined),
        }).exec
      : null;

  return recs.map((r) => {
    if (r.kind === "downgrade_model" && r.refs?.company_id) {
      const b = autoConfidenceForDowngrade(
        learning,
        r.confidence,
        r.refs.company_id,
        strictMinSamples,
        objectiveExec,
      );
      return {
        ...r,
        learning_confidence: b.learning_confidence,
        outcome_adjusted_confidence: b.combined,
      };
    }
    if (r.kind === "block_tool" && r.refs?.tool) {
      const b = autoConfidenceForThrottle(
        learning,
        r.confidence,
        r.refs.tool,
        strictMinSamples,
        objectiveExec,
      );
      return {
        ...r,
        learning_confidence: b.learning_confidence,
        outcome_adjusted_confidence: b.combined,
      };
    }
    const n = learning.global.downgrade.attempts + learning.global.throttle.attempts;
    return {
      ...r,
      learning_confidence: learningCertaintyFromSampleSize(n),
      outcome_adjusted_confidence: r.confidence,
    };
  });
}
