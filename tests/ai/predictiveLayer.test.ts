import { describe, expect, test } from "vitest";

import { selectBestAction } from "@/lib/ai/actionSelector";
import { predictOutcomeWithExperience } from "@/lib/ai/predictiveModel";
import { assessPredictiveRisk } from "@/lib/ai/predictiveRiskEngine";
import { explainPrediction } from "@/lib/ai/predictiveExplain";

describe("predictive layer", () => {
  test("predictOutcomeWithExperience is deterministic", () => {
    const p = predictOutcomeWithExperience({ type: "experiment" }, { conversion: 0.02 }, { experiment: 10 });
    expect(p.predicted_conversion).toBeCloseTo(0.02 + 0.1);
    expect(p.confidence).toBeCloseTo(0.1);
  });

  test("empty experience → base conversion only", () => {
    const p = predictOutcomeWithExperience({ type: "optimize" }, { conversion: 0.03 }, {});
    expect(p.predicted_conversion).toBeCloseTo(0.03);
    expect(p.confidence).toBe(0);
  });

  test("assessPredictiveRisk low confidence", () => {
    expect(assessPredictiveRisk({ predicted_conversion: 0.5, confidence: 0.1 })).toBe("LOW_CONFIDENCE");
  });

  test("assessPredictiveRisk negative prediction", () => {
    expect(assessPredictiveRisk({ predicted_conversion: -0.01, confidence: 0.5 })).toBe("NEGATIVE_IMPACT");
  });

  test("selectBestAction stable tie-break", () => {
    const sims = [
      { action: { type: "optimize" }, prediction: { predicted_conversion: 0.05, confidence: 0.3 } },
      { action: { type: "experiment" }, prediction: { predicted_conversion: 0.05, confidence: 0.3 } },
    ];
    const best = selectBestAction(sims);
    expect(best?.action.type).toBe("experiment");
  });

  test("explainPrediction handles null best", () => {
    const x = explainPrediction({ best: null, simulations: [], risk: "NO_ACTIONS" });
    expect(x.chosen_action).toBeNull();
    expect(x.risk).toBe("NO_ACTIONS");
  });
});
