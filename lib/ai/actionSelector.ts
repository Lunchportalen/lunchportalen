import type { SimulatedAction } from "@/lib/ai/simulationEngine";

/**
 * Picks highest predicted conversion; tie-break by action.type for stable ordering.
 */
export function selectBestAction<A extends { type: string }>(
  simulations: SimulatedAction<A>[],
): SimulatedAction<A> | null {
  if (!Array.isArray(simulations) || simulations.length === 0) return null;
  return [...simulations].sort((a, b) => {
    const d = b.prediction.predicted_conversion - a.prediction.predicted_conversion;
    if (d !== 0) return d;
    return String(a.action.type).localeCompare(String(b.action.type));
  })[0]!;
}
