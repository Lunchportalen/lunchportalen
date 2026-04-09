import "server-only";

import type { GlobalIntelligenceContext } from "@/lib/ai/globalIntelligence";
import type { SingularityGenerativeAction } from "@/lib/ai/generativeEngine";
import { EXPERIENCE_BONUS_CAP, getExperienceScores } from "@/lib/ai/experienceModel";

type ScoredAction = Exclude<SingularityGenerativeAction, null>;

export function scoreAction(action: ScoredAction, ctx: GlobalIntelligenceContext): number {
  let score = 0;
  if (action.type === "experiment") score += 50;
  if (action.type === "variant") score += 30;
  if (action.type === "optimize") score += 20;
  if (ctx.conversion < 0.02) score += 40;
  return score;
}

/**
 * Applies capped experience bonus from {@link getExperienceScores} (already min-sample + decay + cap).
 */
export function applyLearningBonus(
  base: number,
  actionType: string,
  experience: Record<string, number>,
): number {
  const raw = experience[actionType] ?? 0;
  const bonus = Math.min(EXPERIENCE_BONUS_CAP, Math.max(-EXPERIENCE_BONUS_CAP, raw));
  const b = Number.isFinite(base) ? base : 0;
  return b + bonus;
}

/**
 * Per-action adaptive score (one DB read per call). Prefer batching via {@link prioritizeAdaptive}.
 */
export async function scoreActionAdaptive(
  action: ScoredAction,
  ctx: GlobalIntelligenceContext,
): Promise<number> {
  const base = scoreAction(action, ctx);
  try {
    const experience = await getExperienceScores();
    return applyLearningBonus(base, action.type, experience);
  } catch {
    return base;
  }
}
