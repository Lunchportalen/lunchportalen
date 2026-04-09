import "server-only";

import type { GlobalSystemState } from "@/lib/ai/systemState";

export type BlackboxSignal = "LOW_CONVERSION" | "NEGATIVE_REVENUE" | "HIGH_CHURN" | "NO_EXPERIMENTS";

/**
 * Deterministic signal detection from {@link GlobalSystemState}.
 */
export function detectSignals(state: GlobalSystemState): BlackboxSignal[] {
  const signals: BlackboxSignal[] = [];
  if (state.conversion < 0.02) signals.push("LOW_CONVERSION");
  if (state.revenue < 0) signals.push("NEGATIVE_REVENUE");
  if (state.churn > 0.1) signals.push("HIGH_CHURN");
  if (state.experiments === 0) signals.push("NO_EXPERIMENTS");
  return signals;
}
