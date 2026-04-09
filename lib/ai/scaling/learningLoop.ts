import type { AttributionRoiRow } from "@/lib/ai/attribution/roiEngine";

export type ReinforcementSignal = { reinforce: string };

/**
 * Deterministic reinforcement tokens for downstream engines (advisory; no automatic prod writes).
 */
export function reinforceLearning(winners: AttributionRoiRow[]): ReinforcementSignal[] {
  return winners.map((w) => ({
    reinforce: String(w.action ?? "").trim() || "unknown",
  }));
}
