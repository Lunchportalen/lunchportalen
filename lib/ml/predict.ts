import "server-only";

import { loadModel } from "./loadModel";
import type { LinearTrafficConversionModel } from "./model";
import { predictWithLinearModel } from "./model";

function isLinearModel(v: unknown): v is LinearTrafficConversionModel {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.kind === "linear_traffic_conversion" &&
    Array.isArray(o.equation) &&
    o.equation.length >= 2 &&
    Number.isFinite(Number(o.equation[0])) &&
    Number.isFinite(Number(o.equation[1]))
  );
}

export async function predictConversion(traffic: number): Promise<number | null> {
  const raw = await loadModel();
  if (!isLinearModel(raw)) return null;
  return predictWithLinearModel(raw, traffic);
}

export function predictConversionFromLoadedModel(model: unknown, traffic: number): number | null {
  if (!isLinearModel(model)) return null;
  return predictWithLinearModel(model, traffic);
}
