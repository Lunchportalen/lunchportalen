import type { AttributionInsights } from "@/lib/ai/attribution/insightEngine";
import type { AttributionRoiRow } from "@/lib/ai/attribution/roiEngine";
import type { AttributionAggregated } from "@/lib/ai/attribution/aggregationEngine";

export type ScalingState = {
  /** Snapshot of aggregated attribution metrics by action key. */
  attribution: AttributionAggregated;
  roi: AttributionRoiRow[];
  timestamp: number;
};

export function buildScalingState(input: AttributionInsights): ScalingState {
  return {
    attribution: input.aggregated ?? {},
    roi: input.roi ?? [],
    timestamp: Date.now(),
  };
}
