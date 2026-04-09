import { mean } from "simple-statistics";

/**
 * True when mean absolute residual exceeds threshold (deterministic).
 */
export function detectDrift(errors: number[]): boolean {
  if (!errors.length) return false;
  const clean = errors.filter((e) => Number.isFinite(e));
  if (!clean.length) return false;
  return mean(clean) > 0.05;
}
