import { describe, expect, it } from "vitest";

import type { MetricRow } from "@/lib/ml/dataset";
import { trainSequenceModel, predictNextStepConversion } from "@/lib/ml/lstmModel";
import { computeMetricNormStats, normalizeSeries } from "@/lib/ml/normalize";
import { buildSequences } from "@/lib/ml/sequenceBuilder";

function synthRows(n: number): MetricRow[] {
  return Array.from({ length: n }, (_, i) => ({
    ts: 1_700_000_000 + i * 3600,
    conversion: 0.01 * i + 0.02 * Math.sin(i / 3),
    traffic: 100 + i * 2,
    revenue: 50 + i,
    churn: 0.001 * i,
  }));
}

describe("sequence ML (deterministic)", () => {
  it("buildSequences length and targets", () => {
    const rows = synthRows(10);
    const seq = buildSequences(rows, 3);
    expect(seq.length).toBe(7);
    expect(seq[0].input.length).toBe(3);
    expect(seq[0].target).toEqual(rows[3]);
  });

  it("normalizeSeries handles flat series", () => {
    const { normalized, min, max } = normalizeSeries([5, 5, 5]);
    expect(min).toBe(5);
    expect(max).toBe(5);
    expect(normalized.every((v) => v === 0)).toBe(true);
  });

  it("trainSequenceModel is bitwise reproducible for fixed data", () => {
    const rows = synthRows(40);
    const norm = computeMetricNormStats(rows);
    const sequences = buildSequences(rows, 5);
    const a = trainSequenceModel(sequences, norm, 5);
    const b = trainSequenceModel(sequences, norm, 5);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (!a || !b) return;
    expect(a.W_x).toEqual(b.W_x);
    expect(a.W_h).toEqual(b.W_h);
    expect(a.b_y).toBe(b.b_y);
  });

  it("predictNextStepConversion runs after train", () => {
    const rows = synthRows(40);
    const norm = computeMetricNormStats(rows);
    const sequences = buildSequences(rows, 5);
    const model = trainSequenceModel(sequences, norm, 5);
    expect(model).not.toBeNull();
    if (!model) return;
    const lastWindow = rows.slice(-6, -1);
    const y = predictNextStepConversion(lastWindow, model);
    expect(y).not.toBeNull();
    expect(Number.isFinite(y)).toBe(true);
  });
});
