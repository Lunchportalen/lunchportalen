/**
 * AI LUNCH HEALTH ANALYZER ENGINE
 * AI analyserer næringsbalanse: protein, kalorier, variasjon.
 * Kan gi anbefalinger.
 */

import { analyzeLunchHealth } from "@/lib/ai/engines/capabilities/lunchHealthAnalyzer";
import type {
  LunchHealthAnalyzerInput,
  LunchHealthAnalyzerOutput,
  DishNutritionInput,
  NutrientAssessment,
  VariationAssessment,
} from "@/lib/ai/engines/capabilities/lunchHealthAnalyzer";

export type { DishNutritionInput, NutrientAssessment, VariationAssessment };

/** Analyserer næringsbalanse i lunsjmeny og gir anbefalinger. */
export function getLunchHealthAnalysis(
  input: LunchHealthAnalyzerInput
): LunchHealthAnalyzerOutput {
  return analyzeLunchHealth(input);
}

export type LunchHealthAnalyzerEngineKind = "analyze";

export type LunchHealthAnalyzerEngineInput = {
  kind: "analyze";
  input: LunchHealthAnalyzerInput;
};

export type LunchHealthAnalyzerEngineResult = {
  kind: "analyze";
  data: LunchHealthAnalyzerOutput;
};

/**
 * Kjører lunch health analyzer: protein, kalorier, variasjon og anbefalinger.
 */
export function runLunchHealthAnalyzerEngine(
  req: LunchHealthAnalyzerEngineInput
): LunchHealthAnalyzerEngineResult {
  if (req.kind !== "analyze") {
    throw new Error(
      `Unknown lunch health analyzer kind: ${(req as LunchHealthAnalyzerEngineInput).kind}`
    );
  }
  return {
    kind: "analyze",
    data: getLunchHealthAnalysis(req.input),
  };
}
