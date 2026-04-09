import type { CollectedMetrics } from "@/lib/metrics/collect";

export type AutonomyFeatureVector = {
  conversion: number;
  orders: number;
  users: number;
};

export function extractFeatures(context: CollectedMetrics): AutonomyFeatureVector {
  return {
    conversion: context.conversionRate,
    orders: context.orders,
    users: context.users,
  };
}
