import type { ExplorationBand } from "@/lib/growth/capitalAllocation/types";

const LOW_MAX = 500;
const HIGH_MIN = 5000;

/**
 * Total session proxy (sum of views) per market → scales bounded reallocation step.
 * low: ~30–40% of max step, medium: ~15–25%, high: ~5–10%.
 */
export function explorationBandFromMarketSessions(totalSessions: number): ExplorationBand {
  if (totalSessions < LOW_MAX) return "low";
  if (totalSessions > HIGH_MIN) return "high";
  return "medium";
}

export function stepScaleForBand(band: ExplorationBand): number {
  switch (band) {
    case "low":
      return 0.38;
    case "high":
      return 0.08;
    case "medium":
    default:
      return 0.2;
  }
}
