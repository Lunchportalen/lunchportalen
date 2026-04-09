import "server-only";

import { getCompanySaasPlanForAi, planAllowsAi } from "@/lib/ai/entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Unified runner rows in ai_activity_log (lib/ai/runner insertRunnerLog). */
export const AI_RUNNER_LOG_ACTION = "batch" as const;

/**
 * Approximate OpenAI gpt-4o-mini class pricing (USD per token). Estimates only — not invoicing.
 * @see https://openai.com/pricing (adjust when model mix changes)
 */
const USD_PER_PROMPT_TOKEN = 0.15 / 1_000_000;
const USD_PER_COMPLETION_TOKEN = 0.6 / 1_000_000;

export type AiUsageLimits = {
  /** null = no cap */
  maxRunsPerMonth: number | null;
  /** Total prompt + completion tokens per UTC month */
  maxTokensPerMonth: number | null;
  maxCostUsdPerMonth: number | null;
};

export function getAiUsageLimitsForPlan(plan: string): AiUsageLimits {
  switch (plan) {
    case "basic":
      return {
        maxRunsPerMonth: 500,
        maxTokensPerMonth: 600_000,
        maxCostUsdPerMonth: 5,
      };
    case "pro":
      return {
        maxRunsPerMonth: 5_000,
        maxTokensPerMonth: 6_000_000,
        maxCostUsdPerMonth: 50,
      };
    case "enterprise":
      return {
        maxRunsPerMonth: null,
        maxTokensPerMonth: null,
        maxCostUsdPerMonth: null,
      };
    default:
      return {
        maxRunsPerMonth: 0,
        maxTokensPerMonth: 0,
        maxCostUsdPerMonth: 0,
      };
  }
}

export type AiUsagePeriodBounds = {
  periodStartIso: string;
  periodEndIso: string;
  periodLabel: string;
};

export function resolveUtcMonthBounds(monthParam: string | null | undefined): AiUsagePeriodBounds {
  const raw = typeof monthParam === "string" ? monthParam.trim() : "";
  if (raw) {
    if (!/^\d{4}-\d{2}$/.test(raw)) {
      throw new Error("INVALID_MONTH_PARAM");
    }
    const [ys, ms] = raw.split("-");
    const y = Number(ys);
    const m = Number(ms);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      throw new Error("INVALID_MONTH_PARAM");
    }
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    return { periodStartIso: start.toISOString(), periodEndIso: end.toISOString(), periodLabel: raw };
  }

  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const start = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo + 1, 0, 23, 59, 59, 999));
  const label = `${y}-${String(mo + 1).padStart(2, "0")}`;
  return { periodStartIso: start.toISOString(), periodEndIso: end.toISOString(), periodLabel: label };
}

export function estimateUsageCostUsd(promptTokens: number, completionTokens: number): number {
  const p = Number.isFinite(promptTokens) && promptTokens > 0 ? promptTokens : 0;
  const c = Number.isFinite(completionTokens) && completionTokens > 0 ? completionTokens : 0;
  return p * USD_PER_PROMPT_TOKEN + c * USD_PER_COMPLETION_TOKEN;
}

function numFromUnknown(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

function tokensFromRow(row: {
  metadata?: unknown;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
}): { prompt: number; completion: number } {
  const meta =
    row.metadata != null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const prompt =
    numFromUnknown(meta.prompt_tokens) ||
    (typeof row.prompt_tokens === "number" && Number.isFinite(row.prompt_tokens) ? Math.max(0, row.prompt_tokens) : 0);
  const completion =
    numFromUnknown(meta.completion_tokens) ||
    (typeof row.completion_tokens === "number" && Number.isFinite(row.completion_tokens)
      ? Math.max(0, row.completion_tokens)
      : 0);
  return { prompt, completion };
}

export type AiUsageAggregate = {
  total_runs: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_estimate_usd: number;
};

const PAGE_SIZE = 500;

/**
 * Aggregate unified runner usage from ai_activity_log for one company and UTC calendar month.
 */
export async function aggregateCompanyAiRunnerUsage(
  companyId: string,
  bounds: AiUsagePeriodBounds,
): Promise<AiUsageAggregate> {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) {
    throw new Error("MISSING_COMPANY_ID");
  }

  let totalRuns = 0;
  let promptSum = 0;
  let completionSum = 0;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabaseAdmin()
      .from("ai_activity_log")
      .select("metadata, prompt_tokens, completion_tokens")
      .eq("entity_id", id)
      .eq("action", AI_RUNNER_LOG_ACTION)
      .gte("created_at", bounds.periodStartIso)
      .lte("created_at", bounds.periodEndIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`AI_USAGE_READ_FAILED: ${error.message}`);
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) break;

    for (const row of rows) {
      totalRuns += 1;
      const { prompt, completion } = tokensFromRow(row);
      promptSum += prompt;
      completionSum += completion;
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const totalTokens = promptSum + completionSum;
  return {
    total_runs: totalRuns,
    prompt_tokens: promptSum,
    completion_tokens: completionSum,
    total_tokens: totalTokens,
    cost_estimate_usd: estimateUsageCostUsd(promptSum, completionSum),
  };
}

export type AiUsageEnforcementSnapshot = {
  plan: string;
  limits: AiUsageLimits;
  aggregate: AiUsageAggregate;
  period: AiUsagePeriodBounds;
};

export async function getCompanyAiUsageEnforcementSnapshot(
  companyId: string,
  monthParam?: string | null,
): Promise<AiUsageEnforcementSnapshot> {
  const plan = await getCompanySaasPlanForAi(companyId);
  const limits = getAiUsageLimitsForPlan(plan);
  const period = resolveUtcMonthBounds(monthParam ?? null);
  const aggregate = await aggregateCompanyAiRunnerUsage(companyId, period);
  return { plan, limits, aggregate, period };
}

/**
 * Plan gate + monthly caps for unified runner (runAi). Throws same errors as entitlements + USAGE_LIMIT_EXCEEDED.
 */
export async function assertCompanyAiEligibleForRun(companyId: string): Promise<void> {
  const plan = await getCompanySaasPlanForAi(companyId);
  if (!planAllowsAi(plan)) {
    throw new Error(`PLAN_NOT_ALLOWED: saas_plan=${plan}`);
  }

  const limits = getAiUsageLimitsForPlan(plan);
  const period = resolveUtcMonthBounds(null);
  const aggregate = await aggregateCompanyAiRunnerUsage(companyId, period);

  if (limits.maxRunsPerMonth != null && aggregate.total_runs >= limits.maxRunsPerMonth) {
    throw new Error(`USAGE_LIMIT_EXCEEDED:runs:${limits.maxRunsPerMonth}`);
  }

  if (limits.maxTokensPerMonth != null && aggregate.total_tokens >= limits.maxTokensPerMonth) {
    throw new Error(`USAGE_LIMIT_EXCEEDED:tokens:${limits.maxTokensPerMonth}`);
  }

  if (limits.maxCostUsdPerMonth != null && aggregate.cost_estimate_usd >= limits.maxCostUsdPerMonth) {
    throw new Error(`USAGE_LIMIT_EXCEEDED:cost:${limits.maxCostUsdPerMonth}`);
  }
}
