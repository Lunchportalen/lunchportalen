/**
 * Forklaring for revisjon og UI.
 */

import type { AutonomousAction } from "@/lib/autonomy/types";

export function explainDecision(action: AutonomousAction): {
  reason: string;
  expectedImpact: number;
  risk: AutonomousAction["riskLevel"];
} {
  return {
    reason: action.reason,
    expectedImpact: action.expectedProfit,
    risk: action.riskLevel,
  };
}
