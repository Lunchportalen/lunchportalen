import "server-only";

import {
  predictVariantPerformance,
  predictVariantPerformanceAsync,
  type VariantPredictInput,
  type VariantPredictionResult,
} from "@/lib/ai/predictor";

export type RankedVariant<T extends VariantPredictInput> = T & {
  prediction: VariantPredictionResult;
};

export function rankVariants<T extends VariantPredictInput>(variants: T[]): RankedVariant<T>[] {
  return variants
    .map((v) => ({
      ...v,
      prediction: predictVariantPerformance(v),
    }))
    .sort((a, b) => {
      const av = a.prediction.predictedConversion;
      const bv = b.prediction.predictedConversion;
      if (bv !== av) return bv - av;
      return b.prediction.predictedConversionLift - a.prediction.predictedConversionLift;
    });
}

export async function rankVariantsAsync<T extends VariantPredictInput>(variants: T[]): Promise<RankedVariant<T>[]> {
  const items = await Promise.all(
    variants.map(async (v) => ({
      ...v,
      prediction: await predictVariantPerformanceAsync(v),
    })),
  );
  return items.sort((a, b) => {
    const av = a.prediction.predictedConversion;
    const bv = b.prediction.predictedConversion;
    if (bv !== av) return bv - av;
    return b.prediction.predictedConversionLift - a.prediction.predictedConversionLift;
  });
}
