/**
 * Rangerer etter forventet bidrag (profit-first).
 */

import type { AutonomousAction } from "@/lib/autonomy/types";

export function prioritizeActions(actions: AutonomousAction[]): AutonomousAction[] {
  const list = Array.isArray(actions) ? [...actions] : [];
  return list.sort((a, b) => (b.expectedProfit || 0) - (a.expectedProfit || 0));
}
