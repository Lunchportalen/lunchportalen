export type AbPair<T> = {
  A: T;
  B: T;
  /** Deterministic split for routing math (not random traffic). */
  split: number;
};

/**
 * Build A/B pair with fixed 50/50 split metadata (assignment handled by product routing later).
 */
export function createVariant<T>(original: T, improved: T): AbPair<T> {
  return {
    A: original,
    B: improved,
    split: 0.5,
  };
}

/** SoMe A/B persistence (`ab_experiments` / `ab_variants`) — see `socialAb.ts`. */
export { createABTest, createSocialAbExperiment } from "./socialAb";
export type { SocialAbExperimentResult } from "./socialAb";
