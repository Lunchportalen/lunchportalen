export type GrowthMetrics = {
  revenue: number;
  conversion: number;
  errors: number;
};

export type ImpactMeasurement = {
  deltaRevenue: number;
  deltaConversion: number;
  deltaErrors: number;
};

export function measureImpact(before: GrowthMetrics, after: GrowthMetrics): ImpactMeasurement {
  return {
    deltaRevenue: after.revenue - before.revenue,
    deltaConversion: after.conversion - before.conversion,
    deltaErrors: after.errors - before.errors,
  };
}
