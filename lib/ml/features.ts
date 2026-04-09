import { Matrix } from "ml-matrix";

import type { MetricRow } from "./dataset";

export type FeatureRow = MetricRow & {
  conversion_delta: number;
  traffic_delta: number;
  revenue_delta: number;
};

export function buildFeatures(rows: MetricRow[]): FeatureRow[] {
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    return {
      ...r,
      conversion_delta: prev ? r.conversion - prev.conversion : 0,
      traffic_delta: prev ? r.traffic - prev.traffic : 0,
      revenue_delta: prev ? r.revenue - prev.revenue : 0,
    };
  });
}

/** Design matrix [traffic, conversion_delta, revenue_delta] per row (deterministic). */
export function buildFeatureMatrix(rows: FeatureRow[]): Matrix {
  return new Matrix(rows.map((r) => [r.traffic, r.conversion_delta, r.revenue_delta]));
}
