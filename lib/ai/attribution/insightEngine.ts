import { aggregateAttribution } from "./aggregationEngine";
import { calculateROI } from "./roiEngine";

export type AttributionInsights = {
  aggregated: ReturnType<typeof aggregateAttribution>;
  roi: ReturnType<typeof calculateROI>;
  bestAction: string | null;
};

export function buildAttributionInsights(records: unknown[]): AttributionInsights {
  const aggregated = aggregateAttribution(records);
  const roi = calculateROI(aggregated);
  return {
    aggregated,
    roi,
    bestAction: roi[0]?.action ?? null,
  };
}
