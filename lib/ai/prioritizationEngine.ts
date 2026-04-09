import "server-only";

import type { GlobalIntelligenceContext } from "@/lib/ai/globalIntelligence";
import type { SingularityGenerativeAction } from "@/lib/ai/generativeEngine";
import { adjustActionByLearning, type ActionWithLearningWeight } from "@/lib/ai/learning/applyLearning";
import { getExperienceScores } from "@/lib/ai/experienceModel";
import { applyLearningBonus, scoreAction } from "@/lib/ai/valueEngine";
import { opsLog } from "@/lib/ops/log";

export type SingularityActionWithScore = NonNullable<SingularityGenerativeAction> & { score: number; weight?: number };

/** Rule-based priority with optional learning-based weight (server-side retrieval; fail-closed to weight 1). */
export async function prioritize(
  actions: Array<NonNullable<SingularityGenerativeAction>>,
  ctx: GlobalIntelligenceContext,
): Promise<SingularityActionWithScore[]> {
  let adjusted: ActionWithLearningWeight[] = actions;
  try {
    adjusted = await Promise.all(actions.map((a) => adjustActionByLearning(a)));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("prioritize_learning_adjust_failed", { error: message });
    adjusted = actions;
  }
  return adjusted
    .map((a) => ({
      ...a,
      score: scoreAction(a, ctx) * (a.weight ?? 1),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Experience-augmented priority. Falls back to rule-only scores if experience load fails.
 */
export async function prioritizeAdaptive(
  actions: Array<NonNullable<SingularityGenerativeAction>>,
  ctx: GlobalIntelligenceContext,
): Promise<SingularityActionWithScore[]> {
  let experience: Record<string, number> = {};
  try {
    experience = await getExperienceScores();
  } catch {
    experience = {};
  }
  let adjusted: ActionWithLearningWeight[] = actions;
  try {
    adjusted = await Promise.all(actions.map((a) => adjustActionByLearning(a)));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("prioritize_adaptive_learning_adjust_failed", { error: message });
    adjusted = actions;
  }
  return adjusted
    .map((a) => ({
      ...a,
      score: applyLearningBonus(scoreAction(a, ctx), a.type, experience) * (a.weight ?? 1),
    }))
    .sort((a, b) => b.score - a.score);
}
