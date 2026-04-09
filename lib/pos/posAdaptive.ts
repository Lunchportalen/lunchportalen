import "server-only";

import type { PosUnifiedSignals } from "@/lib/pos/signalCollector";
import type { PosSignalPriority } from "@/lib/pos/posStabilizer";

export type PosTriggerHints = {
  had_cms: boolean;
  had_ai_usage: boolean;
  had_growth: boolean;
};

export type PosImpactScores = {
  cms: number;
  ai: number;
  growth: number;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Heuristic 0–1 impact per trigger class from current signals (no LLM). */
export function scorePosImpacts(signals: PosUnifiedSignals, hints: PosTriggerHints): PosImpactScores {
  const pv = Math.max(0, signals.analytics.page_views);
  const trafficNorm = clamp01(Math.log10(1 + pv) / 5);
  const cr = signals.decision_input.conversionRate;
  const crNorm = cr == null || !Number.isFinite(cr) ? 0 : clamp01(cr * 8);

  const cmsFromAnalysis =
    signals.cms_analysis != null ? clamp01((signals.cms_analysis.score ?? 0) / 100) : 0;
  const cms = hints.had_cms ? Math.max(0.22, cmsFromAnalysis, trafficNorm * 0.35) : 0;

  const aiLog = signals.ai_usage.log_rows_approx ?? 0;
  const aiFromUsage = clamp01(Math.log10(1 + aiLog) / 4);
  const rev = signals.decision_input.revenueProxy;
  const revNorm = rev == null || !Number.isFinite(rev) ? 0 : clamp01(rev);
  const ai = hints.had_ai_usage ? Math.max(0.18, aiFromUsage * 0.55 + revNorm * 0.45, trafficNorm * 0.25) : 0;

  const variants = Array.isArray(signals.decision_input.variantPerformance)
    ? signals.decision_input.variantPerformance
    : [];
  const maxAbsLift =
    variants.length === 0 ? 0 : Math.max(...variants.map((v) => Math.abs(Number(v.lift) || 0)), 0);
  const liftNorm = clamp01(maxAbsLift * 4);
  const growth = hints.had_growth ? Math.max(0.15, liftNorm * 0.65 + crNorm * 0.35 + trafficNorm * 0.3) : 0;

  return { cms, ai, growth };
}

function tierTieBreak(p: PosSignalPriority): number {
  if (p === "cms_update") return 0;
  if (p === "ai_usage") return 1;
  return 2;
}

/**
 * Among triggers that actually fired, pick the tier with highest estimated impact.
 * Tie → legacy order cms_update > ai_usage > growth.
 */
export function resolveDynamicPriority(
  impacts: PosImpactScores,
  hints: PosTriggerHints,
  fallback: PosSignalPriority,
): PosSignalPriority {
  const candidates: { p: PosSignalPriority; s: number }[] = [];
  if (hints.had_cms) candidates.push({ p: "cms_update", s: impacts.cms });
  if (hints.had_ai_usage) candidates.push({ p: "ai_usage", s: impacts.ai });
  if (hints.had_growth) candidates.push({ p: "growth", s: impacts.growth });
  if (candidates.length === 0) return fallback;

  candidates.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    return tierTieBreak(a.p) - tierTieBreak(b.p);
  });
  return candidates[0]!.p;
}

export function defaultTriggerHintsFromSource(source?: string): PosTriggerHints {
  const s = source ?? "";
  return {
    had_cms: s.includes("cms_content_changed"),
    had_ai_usage: s.includes("ai_usage_updated"),
    had_growth: s.includes("variant_performance_updated") || s.includes("signup_completed"),
  };
}

export function mergeTriggerHints(
  explicit: PosTriggerHints | undefined,
  source: string | undefined,
): PosTriggerHints {
  const d = defaultTriggerHintsFromSource(source);
  if (!explicit) return d;
  return {
    had_cms: explicit.had_cms || d.had_cms,
    had_ai_usage: explicit.had_ai_usage || d.had_ai_usage,
    had_growth: explicit.had_growth || d.had_growth,
  };
}
