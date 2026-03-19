/**
 * AI MENU OPTIMIZER ENGINE
 * AI analyserer hvilke retter som fungerer.
 * Output: hvilke retter bør beholdes, hvilke bør byttes, hvilke gir høy tilfredshet.
 */

import { analyzeDishPerformance } from "@/lib/ai/capabilities/menuOptimizer";
import type {
  MenuOptimizerInput,
  MenuOptimizerOutput,
  DishPerformanceInput,
  DishRecommendation,
} from "@/lib/ai/capabilities/menuOptimizer";

export type { DishPerformanceInput, DishRecommendation };

/** Analyserer retteytelse og returnerer behold, bytt og høy tilfredshet. */
export function getMenuOptimizerAnalysis(input: MenuOptimizerInput): MenuOptimizerOutput {
  return analyzeDishPerformance(input);
}

export type MenuOptimizerEngineKind = "analyze";

export type MenuOptimizerEngineInput = {
  kind: "analyze";
  input: MenuOptimizerInput;
};

export type MenuOptimizerEngineResult = {
  kind: "analyze";
  data: MenuOptimizerOutput;
};

/**
 * Kjører menu optimizer: hvilke retter bør beholdes, byttes, og som gir høy tilfredshet.
 */
export function runMenuOptimizerEngine(
  req: MenuOptimizerEngineInput
): MenuOptimizerEngineResult {
  if (req.kind !== "analyze") {
    throw new Error(
      `Unknown menu optimizer kind: ${(req as MenuOptimizerEngineInput).kind}`
    );
  }
  return {
    kind: "analyze",
    data: getMenuOptimizerAnalysis(req.input),
  };
}
