import type { LogisticTrainingRow } from "@/lib/ml/logisticBinary";

export type MetricRow = {
  ts: number;
  conversion: number;
  traffic: number;
  revenue: number;
  churn: number;
};

/** Variant-level training events (additive — used by logistic pre-test layer). */
export type VariantDatasetEvent = {
  cta_length?: number;
  title_length?: number;
  has_image?: boolean;
  position_score?: number;
  converted?: boolean;
  value?: number;
};

/**
 * Maps raw events → fixed 4-vector features + label + revenue (deterministic).
 */
export function buildDataset(events: VariantDatasetEvent[]): LogisticTrainingRow[] {
  return events.map((e) => ({
    features: [
      e.cta_length ?? 0,
      e.title_length ?? 0,
      e.has_image ? 1 : 0,
      e.position_score ?? 0,
    ],
    label: e.converted ? 1 : 0,
    revenue: e.value ?? 0,
  }));
}
