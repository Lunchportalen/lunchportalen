import "server-only";

import { opsLog } from "@/lib/ops/log";

import { detectDrift } from "./drift";
import { buildFeatures } from "./features";
import { loadDataset } from "./loadDataset";
import { loadModel } from "./loadModel";
import { predictConversionFromLoadedModel } from "./predict";

const ERROR_WINDOW = 50;

/**
 * Builds mean absolute residual over the last window; deterministic given DB state.
 */
export async function computeConversionDrift(): Promise<{ drift: boolean; errors: number[] }> {
  const errors: number[] = [];
  try {
    const model = await loadModel();
    const rows = await loadDataset();
    const features = buildFeatures(rows);
    if (!model || features.length < 5) {
      return { drift: false, errors: [] };
    }
    const slice = features.slice(-ERROR_WINDOW);
    for (const r of slice) {
      const pred = predictConversionFromLoadedModel(model, r.traffic);
      if (pred == null || !Number.isFinite(pred)) continue;
      errors.push(Math.abs(r.conversion - pred));
    }
    const drift = detectDrift(errors);
    opsLog("ml_drift_eval", { drift, n: errors.length, meanError: errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : 0 });
    return { drift, errors };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("ml_drift_eval_failed", { message });
    return { drift: false, errors: [] };
  }
}
