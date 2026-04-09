import "server-only";

import { getExperienceScores } from "@/lib/ai/experienceModel";

export type PredictionResult = {
  predicted_conversion: number;
  confidence: number;
};

/**
 * Deterministic heuristic: nudges baseline conversion by stored experience signal (already capped in getExperienceScores).
 */
export function predictOutcomeWithExperience(
  action: { type: string },
  ctx: { conversion?: number },
  exp: Record<string, number>,
): PredictionResult {
  const base = Number(ctx.conversion ?? 0);
  const b = Number.isFinite(base) ? base : 0;
  const influence = exp[action.type] ?? 0;
  const inf = Number.isFinite(influence) ? influence : 0;
  const predicted = b + inf * 0.01;
  const confidence = Math.min(1, Math.abs(inf) / 100);
  return {
    predicted_conversion: Number.isFinite(predicted) ? predicted : b,
    confidence: Number.isFinite(confidence) ? confidence : 0,
  };
}

export async function predictOutcome(
  action: { type: string },
  ctx: { conversion?: number },
): Promise<PredictionResult> {
  let exp: Record<string, number> = {};
  try {
    exp = await getExperienceScores();
  } catch {
    exp = {};
  }
  return predictOutcomeWithExperience(action, ctx, exp);
}
