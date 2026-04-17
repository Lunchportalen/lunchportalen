import { describe, expect, test } from "vitest";

import { computeExperienceBonuses, EXPERIENCE_MIN_SAMPLES } from "@/lib/ai/experienceModel";
import { decay } from "@/lib/ai/memoryDecay";
import { evaluateOutcome } from "@/lib/ai/outcomeEvaluator";
import { explainDecision } from "@/lib/ai/explainEngine";
import { applyLearningBonus, scoreAction } from "@/lib/ai/valueEngine";
import type { GlobalIntelligenceContext } from "@/lib/ai/globalIntelligence";

describe("outcome learning layer", () => {
  test("evaluateOutcome is conversion delta", () => {
    const o = evaluateOutcome({ conversion: 0.01 }, { conversion: 0.02 });
    expect(o.outcome_score).toBeCloseTo(0.01);
    expect(o.success).toBe(true);
  });

  test("decay scales deterministically", () => {
    expect(decay(10)).toBe(9);
  });

  test("explainDecision sums", () => {
    const x = explainDecision({ type: "experiment" }, 90, 5);
    expect(x.final_score).toBe(95);
  });

  test("computeExperienceBonuses requires min samples and caps", () => {
    const few = computeExperienceBonuses([
      { action_type: "experiment", outcome_score: 1, success: true },
      { action_type: "experiment", outcome_score: 1, success: true },
    ]);
    expect(few.experiment).toBeUndefined();

    const many = computeExperienceBonuses(
      Array.from({ length: EXPERIENCE_MIN_SAMPLES }, () => ({
        action_type: "experiment",
        outcome_score: 10,
        success: true,
      })),
    );
    expect(many.experiment).toBeDefined();
    expect(Math.abs(many.experiment!)).toBeLessThanOrEqual(50);
  });

  test("applyLearningBonus with empty experience equals base", () => {
    const ctx: GlobalIntelligenceContext = {
      revenue: 0,
      conversion: 0.01,
      traffic: 0,
      churn: 0,
      experiments: 0,
      topPages: [],
      worstPages: [],
    };
    const base = scoreAction({ type: "optimize" }, ctx);
    expect(applyLearningBonus(base, "optimize", {})).toBe(base);
  });
});
