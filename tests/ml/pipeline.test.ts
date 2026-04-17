import { describe, expect, it } from "vitest";

import { buildFeatures } from "@/lib/ml/features";
import { predictWithLinearModel, trainModel } from "@/lib/ml/model";
import type { MetricRow } from "@/lib/ml/dataset";

describe("ML pipeline (deterministic linear)", () => {
  it("recovers slope and intercept for y = 2x + 3", () => {
    const rows: MetricRow[] = Array.from({ length: 20 }, (_, i) => ({
      ts: 1_700_000_000_000 + i * 60_000,
      traffic: i,
      conversion: 2 * i + 3,
      revenue: 0,
      churn: 0,
    }));
    const features = buildFeatures(rows);
    const model = trainModel(features);
    expect(model).not.toBeNull();
    if (!model) return;

    expect(model.equation[0]).toBeCloseTo(2, 5);
    expect(model.equation[1]).toBeCloseTo(3, 5);

    for (const x of [0, 5, 10, 19]) {
      const y = predictWithLinearModel(model, x);
      expect(y).toBeCloseTo(2 * x + 3, 5);
    }
  });

  it("returns null when fewer than 8 points", () => {
    const rows: MetricRow[] = Array.from({ length: 4 }, (_, i) => ({
      ts: i,
      traffic: i,
      conversion: i,
      revenue: 0,
      churn: 0,
    }));
    expect(trainModel(buildFeatures(rows))).toBeNull();
  });
});
