import type { AttributionAggregated } from "./aggregationEngine";

export type AttributionRoiRow = {
  action: string;
  revenue: number;
  cost: number;
  roi: number;
};

export function calculateROI(data: AttributionAggregated): AttributionRoiRow[] {
  const result: AttributionRoiRow[] = [];
  for (const key of Object.keys(data)) {
    const d = data[key];
    const cost = estimateCost(key);
    const revenue = d.revenue ?? 0;
    const roi = cost > 0 ? revenue / cost : 0;
    result.push({
      action: key,
      revenue,
      cost,
      roi,
    });
  }
  return result.sort((a, b) => b.roi - a.roi);
}

function estimateCost(action: string): number {
  switch (action) {
    case "experiment":
      return 50;
    case "variant":
      return 30;
    case "optimize":
      return 20;
    case "revenue":
      return 10;
    default:
      return 10;
  }
}
