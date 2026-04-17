import "server-only";

import {
  resolvePlatformObjective,
  type ObjectiveCheckpoint,
  type StrategyMode,
} from "@/lib/ai/businessObjective";
import type { DecisionInputData } from "@/lib/ai/decisionEngine";
import { runAIAnalysis } from "@/lib/ai/engine";
import type { AiAnalysisEngineResult } from "@/lib/ai/types";
import { getPlatformAiBillingOverview, type PlatformAiBillingOverview } from "@/lib/ai/usageOverview";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export type PosSignalCollectionContext = {
  /** UTC calendar month for platform objective (`YYYY-MM`) or omit for current month. */
  overview_month?: string | null;
  prior_objective_checkpoint?: ObjectiveCheckpoint | null;
  /** Rolling window for event counts (default 30). */
  window_days?: number;
  /** Optional CMS JSON for a single page — drives `cms_analysis` via existing {@link runAIAnalysis}. */
  cms_content_sample?: unknown;
  /** Optional override when experiment evaluator is not run inside this cycle. */
  variant_performance_override?: Array<{ id: string; lift: number }>;
  experiment_win_rates_override?: number[];
};

export type PosAiUsageSignals = {
  log_rows_approx: number;
  error: string | null;
};

export type PosAnalyticsSignals = {
  page_views: number;
  cta_clicks: number;
  searches: number;
  error: string | null;
};

export type PosUnifiedSignals = {
  collected_at: string;
  window_days: number;
  ai_usage: PosAiUsageSignals;
  analytics: PosAnalyticsSignals;
  /** Present when `cms_content_sample` was provided. */
  cms_analysis: AiAnalysisEngineResult | null;
  decision_input: DecisionInputData;
  platform_overview: PlatformAiBillingOverview | null;
  objective: ReturnType<typeof resolvePlatformObjective> | null;
  strategy_mode: StrategyMode | null;
  read_errors: string[];
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - Math.max(1, Math.min(365, days)));
  return d.toISOString();
}

function hasServiceEnv(): boolean {
  return hasSupabaseAdminConfig();
}

/**
 * Aggregates AI log volume, public/content analytics counts, optional CMS analysis,
 * and platform objective — without mutating CMS or experiments.
 */
export async function collectSignals(ctx?: PosSignalCollectionContext): Promise<PosUnifiedSignals> {
  const collected_at = new Date().toISOString();
  const window_days = typeof ctx?.window_days === "number" ? ctx.window_days : 30;
  const since = daysAgoIso(window_days);
  const read_errors: string[] = [];

  let analytics: PosAnalyticsSignals = { page_views: 0, cta_clicks: 0, searches: 0, error: null };

  let ai_usage: PosAiUsageSignals;
  if (!hasServiceEnv()) {
    read_errors.push("MISSING_SUPABASE_SERVICE_ENV");
    ai_usage = { log_rows_approx: 0, error: "MISSING_SUPABASE_SERVICE_ENV" };
    analytics.error = "MISSING_SUPABASE_SERVICE_ENV";
  } else {
    const supabase = supabaseAdmin();

    const { count: aiCount, error: aiErr } = await supabase
      .from("ai_activity_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);

    if (aiErr) {
      read_errors.push(`ai_activity_log:${aiErr.message}`);
      ai_usage = { log_rows_approx: 0, error: aiErr.message };
    } else {
      ai_usage = { log_rows_approx: typeof aiCount === "number" ? aiCount : 0, error: null };
    }

    const [pv, cta, search] = await Promise.all([
      supabase
        .from("content_analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "page_view")
        .gte("created_at", since),
      supabase
        .from("content_analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "cta_click")
        .gte("created_at", since),
      supabase
        .from("content_analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "search")
        .gte("created_at", since),
    ]);

    const aErr = pv.error || cta.error || search.error;
    if (aErr) {
      const msg = pv.error?.message || cta.error?.message || search.error?.message || "analytics_count_failed";
      analytics.error = msg;
      read_errors.push(`content_analytics_events:${msg}`);
    } else {
      analytics = {
        page_views: typeof pv.count === "number" ? pv.count : 0,
        cta_clicks: typeof cta.count === "number" ? cta.count : 0,
        searches: typeof search.count === "number" ? search.count : 0,
        error: null,
      };
    }
  }

  let cms_analysis: AiAnalysisEngineResult | null = null;
  if (ctx?.cms_content_sample !== undefined) {
    try {
      cms_analysis = await runAIAnalysis(ctx.cms_content_sample);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      read_errors.push(`runAIAnalysis:${msg}`);
    }
  }

  const pv = analytics.page_views;
  const ctaN = analytics.cta_clicks;
  const cr = pv > 0 ? ctaN / pv : null;

  const variantPerformance = Array.isArray(ctx?.variant_performance_override)
    ? ctx!.variant_performance_override!
    : [];

  const experimentWinRates = Array.isArray(ctx?.experiment_win_rates_override)
    ? ctx!.experiment_win_rates_override!.filter((n) => typeof n === "number")
    : [];

  const decision_input: DecisionInputData = {
    conversionRate: cr ?? undefined,
    traffic: pv > 0 ? pv : undefined,
    engagementScore: cms_analysis != null ? Math.min(1, Math.max(0, cms_analysis.score / 100)) : undefined,
    variantPerformance,
    experimentWinRates: experimentWinRates.length ? experimentWinRates : undefined,
    funnelDropRate: undefined,
    seoOrganicDelta: undefined,
    notes: "pos_signal_collector",
  };

  let platform_overview: PlatformAiBillingOverview | null = null;
  let objective: ReturnType<typeof resolvePlatformObjective> | null = null;
  let strategy_mode: StrategyMode | null = null;

  if (hasServiceEnv()) {
    try {
      platform_overview = await getPlatformAiBillingOverview(ctx?.overview_month ?? null);
      objective = resolvePlatformObjective(platform_overview, ctx?.prior_objective_checkpoint ?? null);
      strategy_mode = objective.strategy_mode;
      decision_input.revenueProxy = objective.score;
      if (cms_analysis == null && objective.score > 0) {
        decision_input.engagementScore = objective.score;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      read_errors.push(`platform_overview:${msg}`);
    }
  }

  return {
    collected_at,
    window_days,
    ai_usage,
    analytics,
    cms_analysis,
    decision_input,
    platform_overview,
    objective,
    strategy_mode,
    read_errors,
  };
}
