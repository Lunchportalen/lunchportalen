import type { SystemAnalysis } from "@/lib/autonomy/analyze";
import type { DerivedSignals, ScoredAutonomyAction } from "@/lib/autonomy/growthTypes";

export function scoreActions(signals: DerivedSignals): ScoredAutonomyAction[] {
  const actions: ScoredAutonomyAction[] = [];

  if (signals.lowConversion) {
    actions.push({
      type: "price_drop",
      score: 0.8,
      change: -5,
    });
  }

  if (signals.noDemand) {
    actions.push({
      type: "activate_ads",
      score: 0.9,
    });
  }

  return actions.sort((a, b) => b.score - a.score);
}

/** Predictive layer from trend + forecast (deterministic; no randomness). */
export function predictiveDecisions(analysis: SystemAnalysis): ScoredAutonomyAction[] {
  const actions: ScoredAutonomyAction[] = [];

  if (analysis.conversionTrend < 0) {
    actions.push({
      type: "price_drop",
      score: 0.9,
      change: -5,
      reason: "conversion declining",
    });
  }

  if (analysis.forecastOrders === 0) {
    actions.push({
      type: "activate_ads",
      score: 0.95,
      reason: "forecast zero demand",
    });
  }

  return actions;
}
