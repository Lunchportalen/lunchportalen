import type { CollectedMetrics } from "@/lib/metrics/collect";
import type { DerivedSignals } from "@/lib/autonomy/growthTypes";

export function deriveSignals(metrics: CollectedMetrics): DerivedSignals {
  return {
    lowConversion: metrics.conversionRate < 0.02,
    noDemand: metrics.orders === 0,
    growthSpike: metrics.orders > 50,
  };
}
