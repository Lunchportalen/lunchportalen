import "server-only";

import type { StrategyMode } from "@/lib/ai/businessObjective";
import { parseAdaptiveLearning, type PlatformAdaptiveLearning } from "@/lib/ai/adaptiveLearning";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Superadmin dashboard lock for AI business strategy (in `ai_platform_governance.data.business_engine`). */
export type PlatformBusinessEngineConfig = {
  strategy_override: StrategyMode | null;
};

export type CompanyRunnerGovernance = {
  model_tier: "default" | "economy";
  blocked_tools: string[];
  policy_notes: string | null;
};

export type PlatformThrottleEntry = { tool: string; until: string };

/** Drift / rollout mode for AI governance auto-executor (env `AI_GOVERNANCE_AUTO_MODE`). */
export type AiGovernanceAutoDriftMode = "observe" | "assist" | "auto";

/** Persisted fail-safe + last run metadata (stored in `ai_platform_governance.data`). */
export type PlatformAutoExecutionState = {
  consecutive_errors: number;
  /** When set and in the future, trusted auto mutations are blocked (observe-only). */
  disabled_until: string | null;
  last_run_rid: string | null;
  last_run_at: string | null;
  last_run_step_errors: number;
};

export type PlatformAutoExecutionAdaptiveSnapshot = {
  requested_drift: AiGovernanceAutoDriftMode;
  effective_drift: AiGovernanceAutoDriftMode;
  cooldown_multiplier: number;
  min_auto_confidence: number;
  effective_cooldown_downgrade_ms: number;
  effective_cooldown_throttle_ms: number;
  global_downgrade_success_rate: number | null;
  global_throttle_success_rate: number | null;
  /** Business-objective composite (0–1) at executor run; null if absent in stored summary. */
  objective_score?: number | null;
  /** 1 − objective_score (higher ⇒ more appetite for cost-control auto). */
  objective_stress?: number | null;
  margin_gap_stress?: number | null;
  growth_gap_stress?: number | null;
  strategy_mode?: "profit" | "growth" | "balance" | null;
};

/** Last cron/motor summary for operators (monitoring). */
export type PlatformAutoExecutionSummary = {
  rid: string;
  at: string;
  period: string;
  mode: AiGovernanceAutoDriftMode;
  observe_only: boolean;
  fail_safe_active: boolean;
  adaptive?: PlatformAutoExecutionAdaptiveSnapshot;
  counts: {
    mutations_applied: number;
    skipped: number;
    errors: number;
    cooldown_skipped: number;
    period_cap_skipped: number;
    fail_safe_skipped: number;
    assist_blocked_downgrades: number;
    confidence_threshold_skipped: number;
    learning_gate_skipped: number;
  };
  limits: {
    max_actions_per_period: number;
    auto_applies_in_period_at_start: number;
    cooldown_downgrade_ms: number;
    cooldown_throttle_ms: number;
    error_streak_max: number;
    disable_cooldown_hours: number;
  };
};

export type PlatformRunnerGovernance = {
  blocked_tools: string[];
  policy_notes: string | null;
  /** Time-boxed soft throttle (runner rejects until `until` ISO time). */
  throttled_tools: PlatformThrottleEntry[];
  auto_execution_state?: PlatformAutoExecutionState;
  auto_execution_last_summary?: PlatformAutoExecutionSummary;
  /** Auto-executor adaptive learning (success rates, drift, dynamic thresholds). */
  auto_adaptive_learning?: PlatformAdaptiveLearning;
  /** Optional: manual strategy mode override (see `/api/ai/business-engine`). */
  business_engine?: PlatformBusinessEngineConfig;
};

const EMPTY_COMPANY: CompanyRunnerGovernance = {
  model_tier: "default",
  blocked_tools: [],
  policy_notes: null,
};

function parseCompanyGov(raw: unknown): CompanyRunnerGovernance {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY_COMPANY };
  const o = raw as Record<string, unknown>;
  const tier = o.model_tier === "economy" ? "economy" : "default";
  const bt = o.blocked_tools;
  const blocked =
    Array.isArray(bt) ? bt.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
  const notes = typeof o.policy_notes === "string" ? o.policy_notes : null;
  return { model_tier: tier, blocked_tools: blocked, policy_notes: notes };
}

function parseThrottledTools(raw: unknown): PlatformThrottleEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: PlatformThrottleEntry[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    const tool = typeof o.tool === "string" ? o.tool.trim() : "";
    const until = typeof o.until === "string" ? o.until.trim() : "";
    if (tool && until) out.push({ tool, until });
  }
  return out;
}

function parseAutoExecutionState(raw: unknown): PlatformAutoExecutionState | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const ce = o.consecutive_errors;
  const consecutive_errors =
    typeof ce === "number" && Number.isFinite(ce) ? Math.max(0, Math.floor(ce)) : 0;
  const du = o.disabled_until;
  const disabled_until = typeof du === "string" && du.trim() ? du.trim() : null;
  const lr = o.last_run_rid;
  const last_run_rid = typeof lr === "string" && lr.trim() ? lr.trim() : null;
  const la = o.last_run_at;
  const last_run_at = typeof la === "string" && la.trim() ? la.trim() : null;
  const se = o.last_run_step_errors;
  const last_run_step_errors =
    typeof se === "number" && Number.isFinite(se) ? Math.max(0, Math.floor(se)) : 0;
  return { consecutive_errors, disabled_until, last_run_rid, last_run_at, last_run_step_errors };
}

function num0(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  return 0;
}

function numF(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

function parseAutoExecutionSummary(raw: unknown): PlatformAutoExecutionSummary | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const rid = typeof o.rid === "string" ? o.rid : "";
  const at = typeof o.at === "string" ? o.at : "";
  const period = typeof o.period === "string" ? o.period : "";
  const modeRaw = typeof o.mode === "string" ? o.mode.toLowerCase() : "";
  const mode: AiGovernanceAutoDriftMode =
    modeRaw === "observe" || modeRaw === "assist" || modeRaw === "auto" ? modeRaw : "auto";
  if (!rid || !at || !period) return undefined;
  const c = o.counts;
  const counts =
    c && typeof c === "object" && !Array.isArray(c)
      ? (c as Record<string, unknown>)
      : {};
  const l = o.limits;
  const limits =
    l && typeof l === "object" && !Array.isArray(l)
      ? (l as Record<string, unknown>)
      : {};
  const adapt = o.adaptive;
  let adaptive: PlatformAutoExecutionAdaptiveSnapshot | undefined;
  if (adapt && typeof adapt === "object" && !Array.isArray(adapt)) {
    const a = adapt as Record<string, unknown>;
    const req = typeof a.requested_drift === "string" ? a.requested_drift.toLowerCase() : "";
    const eff = typeof a.effective_drift === "string" ? a.effective_drift.toLowerCase() : "";
    const requested_drift: AiGovernanceAutoDriftMode =
      req === "observe" || req === "assist" || req === "auto" ? req : "auto";
    const effective_drift: AiGovernanceAutoDriftMode =
      eff === "observe" || eff === "assist" || eff === "auto" ? eff : requested_drift;
    const os = a.objective_score;
    const objective_score =
      typeof os === "number" && Number.isFinite(os) ? Math.min(1, Math.max(0, os)) : null;
    const ost = a.objective_stress;
    const objective_stress =
      typeof ost === "number" && Number.isFinite(ost) ? Math.min(1, Math.max(0, ost)) : null;
    const mgs = a.margin_gap_stress;
    const margin_gap_stress =
      typeof mgs === "number" && Number.isFinite(mgs) ? Math.min(1, Math.max(0, mgs)) : null;
    const ggs = a.growth_gap_stress;
    const growth_gap_stress =
      typeof ggs === "number" && Number.isFinite(ggs) ? Math.min(1, Math.max(0, ggs)) : null;
    const smRaw = typeof a.strategy_mode === "string" ? a.strategy_mode.trim().toLowerCase() : "";
    const strategy_mode =
      smRaw === "profit" || smRaw === "growth" || smRaw === "balance"
        ? (smRaw as "profit" | "growth" | "balance")
        : null;
    adaptive = {
      requested_drift,
      effective_drift,
      cooldown_multiplier: numF(a.cooldown_multiplier, 1),
      min_auto_confidence: numF(a.min_auto_confidence, 0.42),
      effective_cooldown_downgrade_ms: num0(a.effective_cooldown_downgrade_ms),
      effective_cooldown_throttle_ms: num0(a.effective_cooldown_throttle_ms),
      global_downgrade_success_rate:
        typeof a.global_downgrade_success_rate === "number" && Number.isFinite(a.global_downgrade_success_rate)
          ? a.global_downgrade_success_rate
          : null,
      global_throttle_success_rate:
        typeof a.global_throttle_success_rate === "number" && Number.isFinite(a.global_throttle_success_rate)
          ? a.global_throttle_success_rate
          : null,
      ...(objective_score != null ? { objective_score } : {}),
      ...(objective_stress != null ? { objective_stress } : {}),
      ...(margin_gap_stress != null ? { margin_gap_stress } : {}),
      ...(growth_gap_stress != null ? { growth_gap_stress } : {}),
      ...(strategy_mode != null ? { strategy_mode } : {}),
    };
  }
  return {
    rid,
    at,
    period,
    mode,
    observe_only: o.observe_only === true,
    fail_safe_active: o.fail_safe_active === true,
    ...(adaptive ? { adaptive } : {}),
    counts: {
      mutations_applied: num0(counts.mutations_applied),
      skipped: num0(counts.skipped),
      errors: num0(counts.errors),
      cooldown_skipped: num0(counts.cooldown_skipped),
      period_cap_skipped: num0(counts.period_cap_skipped),
      fail_safe_skipped: num0(counts.fail_safe_skipped),
      assist_blocked_downgrades: num0(counts.assist_blocked_downgrades),
      confidence_threshold_skipped: num0(counts.confidence_threshold_skipped),
      learning_gate_skipped: num0(counts.learning_gate_skipped),
    },
    limits: {
      max_actions_per_period: num0(limits.max_actions_per_period),
      auto_applies_in_period_at_start: num0(limits.auto_applies_in_period_at_start),
      cooldown_downgrade_ms: num0(limits.cooldown_downgrade_ms),
      cooldown_throttle_ms: num0(limits.cooldown_throttle_ms),
      error_streak_max: num0(limits.error_streak_max),
      disable_cooldown_hours: num0(limits.disable_cooldown_hours),
    },
  };
}

function parseBusinessEngine(raw: unknown): PlatformBusinessEngineConfig | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const so = o.strategy_override;
  if (so === null) return { strategy_override: null };
  if (so === "profit" || so === "growth" || so === "balance") return { strategy_override: so };
  return undefined;
}

function parsePlatformData(raw: unknown): PlatformRunnerGovernance {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { blocked_tools: [], policy_notes: null, throttled_tools: [] };
  }
  const o = raw as Record<string, unknown>;
  const bt = o.blocked_tools;
  const blocked =
    Array.isArray(bt) ? bt.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
  const notes =
    "policy_notes" in o && typeof o.policy_notes === "string"
      ? o.policy_notes
      : "policy_notes" in o && o.policy_notes === null
        ? null
        : null;
  const aes = parseAutoExecutionState(o.auto_execution_state);
  const summ = parseAutoExecutionSummary(o.auto_execution_last_summary);
  const learn = parseAdaptiveLearning(o.auto_adaptive_learning);
  const be = parseBusinessEngine(o.business_engine);
  return {
    blocked_tools: blocked,
    policy_notes: notes,
    throttled_tools: parseThrottledTools(o.throttled_tools),
    ...(aes ? { auto_execution_state: aes } : {}),
    ...(summ ? { auto_execution_last_summary: summ } : {}),
    ...(learn ? { auto_adaptive_learning: learn } : {}),
    ...(be ? { business_engine: be } : {}),
  };
}

export async function loadCompanyRunnerGovernance(companyId: string): Promise<CompanyRunnerGovernance> {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return { ...EMPTY_COMPANY };

  const { data, error } = await supabaseAdmin()
    .from("companies")
    .select("ai_runner_governance")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return { ...EMPTY_COMPANY };
  return parseCompanyGov(data.ai_runner_governance);
}

export async function loadPlatformRunnerGovernance(): Promise<PlatformRunnerGovernance> {
  const { data, error } = await supabaseAdmin()
    .from("ai_platform_governance")
    .select("data")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data?.data) {
    return { blocked_tools: [], policy_notes: null, throttled_tools: [] };
  }
  return parsePlatformData(data.data);
}

/** Full platform row write (preserves extended fields caller merges from load). */
export async function savePlatformRunnerGovernance(gov: PlatformRunnerGovernance): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("ai_platform_governance")
    .upsert(
      {
        id: 1,
        data: gov as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) throw new Error(`PLATFORM_GOV_WRITE_FAILED: ${error.message}`);
}

export function isAutoExecutionFailSafeActive(state: PlatformAutoExecutionState | undefined): boolean {
  if (!state?.disabled_until) return false;
  const t = Date.parse(state.disabled_until);
  return Number.isFinite(t) && t > Date.now();
}

/** Active throttle: `until` is in the future. */
export function activePlatformThrottleForTool(entries: PlatformThrottleEntry[], tool: string): PlatformThrottleEntry | null {
  const t = typeof tool === "string" ? tool.trim() : "";
  if (!t) return null;
  const now = Date.now();
  for (const e of entries) {
    if (e.tool !== t) continue;
    const ts = Date.parse(e.until);
    if (Number.isFinite(ts) && ts > now) return e;
  }
  return null;
}

export type MergedGovernanceForRun = {
  platform_blocked_tools: string[];
  platform_throttled_tools: PlatformThrottleEntry[];
  company: CompanyRunnerGovernance;
};

export async function loadMergedGovernanceForRun(companyId: string): Promise<MergedGovernanceForRun> {
  const [platform, company] = await Promise.all([
    loadPlatformRunnerGovernance(),
    loadCompanyRunnerGovernance(companyId),
  ]);
  return {
    platform_blocked_tools: platform.blocked_tools,
    platform_throttled_tools: platform.throttled_tools,
    company,
  };
}

export function isToolBlockedByGovernance(
  merged: MergedGovernanceForRun,
  tool: string,
): { blocked: boolean; scope: "platform" | "company" | null } {
  const t = typeof tool === "string" ? tool.trim() : "";
  if (!t) return { blocked: false, scope: null };
  if (merged.platform_blocked_tools.includes(t)) return { blocked: true, scope: "platform" };
  if (merged.company.blocked_tools.includes(t)) return { blocked: true, scope: "company" };
  return { blocked: false, scope: null };
}

export function isToolThrottledByPlatformGovernance(merged: MergedGovernanceForRun, tool: string): boolean {
  return activePlatformThrottleForTool(merged.platform_throttled_tools, tool) != null;
}
