import "server-only";

import { collectSignals } from "@/lib/ai/signals";

export type AutonomyDecisionType = "improve_prompts" | "scale_content";

export type AutonomyDecision = {
  type: AutonomyDecisionType;
  reason: string;
  priority: "high" | "medium" | "low";
};

/**
 * Rule-based decisions from aggregated signals (no LLM; deterministic).
 */
export async function generateDecisions(): Promise<AutonomyDecision[]> {
  const signals = await collectSignals();

  const decisions: AutonomyDecision[] = [];

  if (signals.conversionRate < 0.02) {
    decisions.push({
      type: "improve_prompts",
      reason: "Low conversion rate",
      priority: "high",
    });
  }

  if (signals.revenue > 0 && signals.conversionRate > 0.05) {
    decisions.push({
      type: "scale_content",
      reason: "High performing AI",
      priority: "medium",
    });
  }

  return decisions;
}
