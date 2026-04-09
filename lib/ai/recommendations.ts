import "server-only";

import { generateDecisions } from "@/lib/ai/decisions";

export type AutonomyRecommendation = {
  title: string;
  action: string;
  priority: "high" | "medium" | "low";
  decisionType: string;
  reason: string;
};

/**
 * Human-readable recommendations only — no execution.
 */
export async function getRecommendations(): Promise<AutonomyRecommendation[]> {
  const decisions = await generateDecisions();

  return decisions.map((d) => {
    if (d.type === "improve_prompts") {
      return {
        title: "Forbedre AI prompts",
        action: "update_prompts",
        priority: d.priority,
        decisionType: d.type,
        reason: d.reason,
      };
    }

    if (d.type === "scale_content") {
      return {
        title: "Skaler innhold",
        action: "increase_ai_usage",
        priority: d.priority,
        decisionType: d.type,
        reason: d.reason,
      };
    }

    return {
      title: d.type,
      action: "review",
      priority: d.priority,
      decisionType: d.type,
      reason: d.reason,
    };
  });
}
