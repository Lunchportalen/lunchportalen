import regression from "regression";

import { ML_PIPELINE_VERSION, ML_SEED_LABEL } from "./constants";
import type { FeatureRow } from "./features";

export type LinearTrafficConversionModel = {
  kind: "linear_traffic_conversion";
  version: number;
  seedLabel: string;
  /** y = equation[0] * x + equation[1] (regression-js linear convention). */
  equation: [number, number];
  r2: number;
  trainedAt: number;
  n: number;
};

const MIN_POINTS = 8;

export function trainModel(features: FeatureRow[]): LinearTrafficConversionModel | null {
  const pairs: [number, number][] = features
    .filter((d) => Number.isFinite(d.traffic) && Number.isFinite(d.conversion))
    .map((d) => [d.traffic, d.conversion]);
  if (pairs.length < MIN_POINTS) {
    return null;
  }
  const result = regression.linear(pairs);
  const eq = result.equation;
  if (!Array.isArray(eq) || eq.length < 2) {
    return null;
  }
  return {
    kind: "linear_traffic_conversion",
    version: ML_PIPELINE_VERSION,
    seedLabel: ML_SEED_LABEL,
    equation: [Number(eq[0]), Number(eq[1])],
    r2: Number(result.r2),
    trainedAt: Date.now(),
    n: pairs.length,
  };
}

export function predictWithLinearModel(model: LinearTrafficConversionModel, traffic: number): number | null {
  if (!Number.isFinite(traffic)) return null;
  const [m, b] = model.equation;
  if (!Number.isFinite(m) || !Number.isFinite(b)) return null;
  return m * traffic + b;
}

/** Variant pre-test logistic (additive — see `./logisticBinary`). */
export { DEFAULT_LOGISTIC_WEIGHTS, predict, train } from "./logisticBinary";
