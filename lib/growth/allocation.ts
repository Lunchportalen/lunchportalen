import type { RoiMap } from "@/lib/growth/roi";

/**
 * Fordeler budsjett proporsjonalt med effektivitet (omsetning per post).
 * Ingen eksekvering — kun tall for visning.
 */
export function allocateBudget(roiData: RoiMap, totalBudget = 100_000): Record<string, number> {
  const entries = Object.entries(roiData);
  const totalScore = entries.reduce((sum, [, v]) => sum + Math.max(0, v.efficiency), 0);
  if (totalScore <= 0) return {};

  const allocation: Record<string, number> = {};
  for (const [channel, data] of entries) {
    const eff = Math.max(0, data.efficiency);
    allocation[channel] = (eff / totalScore) * totalBudget;
  }
  return allocation;
}
