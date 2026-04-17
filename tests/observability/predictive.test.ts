import { describe, expect, test } from "vitest";

import { computeBaseline } from "@/lib/observability/predictiveBaseline";
import { classifyAnomaly } from "@/lib/observability/predictiveClassifier";
import { scoreAnomaly } from "@/lib/observability/predictiveScoring";

describe("predictive anomaly (statistical)", () => {
  test("computeBaseline empty", () => {
    expect(computeBaseline([])).toEqual({ mean: 0, std: 0 });
  });

  test("z-score and classification", () => {
    const baseline = computeBaseline([10, 10, 10, 10]);
    expect(scoreAnomaly(10, baseline)).toBe(0);
    const b2 = computeBaseline([0, 0, 0, 10]);
    const z = scoreAnomaly(10, b2);
    expect(z).toBeGreaterThan(0);
    expect(classifyAnomaly(z)).not.toBe("NORMAL");
  });

  test("classifyAnomaly thresholds", () => {
    expect(classifyAnomaly(0)).toBe("NORMAL");
    expect(classifyAnomaly(1.6)).toBe("MEDIUM");
    expect(classifyAnomaly(2.1)).toBe("HIGH");
    expect(classifyAnomaly(3.1)).toBe("CRITICAL");
  });
});
