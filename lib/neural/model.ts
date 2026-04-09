import "server-only";

import type { TemporalFeatures } from "@/lib/neural/features";

/** Explainable linear policy over temporal features (no real NN). */
export const POLICY: { weights: Record<string, number> } = {
  weights: {
    price_drop: 0,
    activate_ads: 0,
  },
};

export type PolicyScores = Record<string, number>;

export function evaluatePolicy(features: TemporalFeatures): PolicyScores {
  return {
    price_drop: POLICY.weights.price_drop + features.avgDelta * -1,
    activate_ads: POLICY.weights.activate_ads + (features.volatility || 0),
  };
}
