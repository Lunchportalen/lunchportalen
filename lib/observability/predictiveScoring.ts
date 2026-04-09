import type { BaselineStats } from "./predictiveBaseline";

export function scoreAnomaly(value: number, baseline: BaselineStats): number {
  if (baseline.std === 0) return 0;
  const z = Math.abs((value - baseline.mean) / baseline.std);
  return z;
}
