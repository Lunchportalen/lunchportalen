import type { ImpactMeasurement } from "@/lib/experiment/measure";

export type LearningRow = {
  action: string;
  measurement: ImpactMeasurement;
};

/**
 * Deterministic filter: keep measurable wins (revenue up or errors down).
 */
export function updateLearning(results: LearningRow[]): LearningRow[] {
  return results.filter(
    (r) => r.measurement.deltaRevenue > 0 || r.measurement.deltaErrors < 0
  );
}
