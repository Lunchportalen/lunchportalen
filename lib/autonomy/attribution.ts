import type { CollectedMetrics } from "@/lib/metrics/collect";

export function attribute(
  _action: unknown,
  metricsBefore: CollectedMetrics,
  metricsAfter: CollectedMetrics,
) {
  return {
    deltaOrders: metricsAfter.orders - metricsBefore.orders,
    deltaConversion: metricsAfter.conversionRate - metricsBefore.conversionRate,
  };
}
