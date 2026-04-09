import type { AutonomyRecommendationAction } from "@/lib/autonomy/recommendationsTypes";

/** Scored candidates from {@link scoreActions} / {@link predictiveDecisions} (growth pipeline). */
export type ScoredAutonomyAction =
  | { type: "price_drop"; score: number; change: number; reason?: string }
  | { type: "activate_ads"; score: number; reason?: string };

export type AnyAutonomyAction = AutonomyRecommendationAction | ScoredAutonomyAction;

export type DerivedSignals = {
  lowConversion: boolean;
  noDemand: boolean;
  growthSpike: boolean;
};
