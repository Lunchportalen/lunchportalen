/**
 * AI LUNCH MENU OPTIMIZER
 * AI analyserer: historiske bestillinger, sesong, vær, kontorvaner – og foreslår optimal lunsjmeny.
 * Dette er ekstremt relevant for Lunchportalen.
 */

import { optimizeLunchMenu } from "@/lib/ai/engines/capabilities/optimizeLunchMenu";
import type {
  OptimizeLunchMenuInput,
  OptimizeLunchMenuOutput,
  HistoricalOrderEntry,
  Season,
  WeatherHint,
  OfficeHabitsInput,
  CandidateDish,
  SuggestedDay,
} from "@/lib/ai/engines/capabilities/optimizeLunchMenu";

export type {
  HistoricalOrderEntry,
  Season,
  WeatherHint,
  OfficeHabitsInput,
  CandidateDish,
  SuggestedDay,
};

/** Foreslår optimal lunsjmeny basert på historikk, sesong, vær og kontorvaner. */
export function suggestOptimalMenu(input: OptimizeLunchMenuInput): OptimizeLunchMenuOutput {
  return optimizeLunchMenu(input);
}

/** Type for dispatch (én kind). */
export type LunchMenuOptimizerKind = "suggest_menu";

export type LunchMenuOptimizerInput = {
  kind: "suggest_menu";
  input: OptimizeLunchMenuInput;
};

export type LunchMenuOptimizerResult = {
  kind: "suggest_menu";
  data: OptimizeLunchMenuOutput;
};

/**
 * Kjører lunch menu optimizer: foreslår optimal meny.
 */
export function runLunchMenuOptimizer(req: LunchMenuOptimizerInput): LunchMenuOptimizerResult {
  if (req.kind !== "suggest_menu") {
    throw new Error(`Unknown lunch menu optimizer kind: ${(req as LunchMenuOptimizerInput).kind}`);
  }
  return {
    kind: "suggest_menu",
    data: suggestOptimalMenu(req.input),
  };
}
