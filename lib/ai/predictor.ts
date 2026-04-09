import "server-only";

import { predict as logisticPredict } from "@/lib/ml/logisticBinary";
import { runModel as runOnnxModel } from "@/lib/ml/onnx";

export type VariantPredictInput = {
  cta?: string;
  title?: string;
  hasImage?: boolean;
  positionScore?: number;
};

function featureVector(variant: VariantPredictInput): [number, number, number, number] {
  return [
    Math.min(100, variant.cta?.length ?? 0),
    Math.min(100, variant.title?.length ?? 0),
    variant.hasImage ? 1 : 0,
    typeof variant.positionScore === "number" && Number.isFinite(variant.positionScore) ? variant.positionScore : 0,
  ];
}

export type VariantPredictionResult = {
  predictedConversion: number;
  /** Legacy rank key — mirrors probability for backward compatibility. */
  predictedConversionLift: number;
  explain: { model: string; features: [number, number, number, number] };
};

/**
 * Pre-test conversion probability (logistic on 4 features). Deterministic; log `explain` for audit.
 */
export function predictVariantPerformance(variant: VariantPredictInput): VariantPredictionResult {
  const features = featureVector(variant);
  const predictedConversion = logisticPredict(features);
  const rounded = Math.round(predictedConversion * 1000) / 1000;
  return {
    predictedConversion: rounded,
    predictedConversionLift: rounded,
    explain: { model: "logistic_binary_v1", features },
  };
}

/**
 * Optional ONNX path when `LP_ONNX_ENABLED=true` and model loads; otherwise identical to {@link predictVariantPerformance}.
 */
export async function predictVariantPerformanceAsync(variant: VariantPredictInput): Promise<VariantPredictionResult> {
  const features = featureVector(variant);
  const base = predictVariantPerformance(variant);

  const floatFeatures = new Float32Array([
    variant.cta?.length ?? 0,
    variant.title?.length ?? 0,
    variant.hasImage ? 1 : 0,
    typeof variant.positionScore === "number" && Number.isFinite(variant.positionScore) ? variant.positionScore : 0,
  ]);

  const out = await runOnnxModel(floatFeatures);
  if (!out || out.length < 1) {
    return base;
  }

  const raw = out[0];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return base;
  }

  const p = Math.max(0, Math.min(1, raw));
  const rounded = Math.round(p * 1000) / 1000;
  return {
    predictedConversion: rounded,
    predictedConversionLift: rounded,
    explain: { model: "onnx_optional", features },
  };
}
