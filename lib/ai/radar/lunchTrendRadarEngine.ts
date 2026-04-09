/**
 * AI FOOD TREND ENGINE / LUNCH TREND RADAR ENGINE
 * AI overvåker mattrender og foreslår nye retter.
 */

import { getTrendReport } from "@/lib/ai/engines/capabilities/lunchTrendRadar";
import type {
  LunchTrendRadarInput,
  LunchTrendRadarOutput,
  TrendConcept,
  SuggestedDishFromTrend,
} from "@/lib/ai/engines/capabilities/lunchTrendRadar";

export type { TrendConcept, SuggestedDishFromTrend };

/** Overvåker mattrender og foreslår nye retter (og konsepter). */
export function getLunchTrendReport(input: LunchTrendRadarInput): LunchTrendRadarOutput {
  return getTrendReport(input);
}

export type LunchTrendRadarEngineKind = "report";

export type LunchTrendRadarEngineInput = {
  kind: "report";
  input: LunchTrendRadarInput;
};

export type LunchTrendRadarEngineResult = {
  kind: "report";
  data: LunchTrendRadarOutput;
};

/**
 * Kjører lunch trend radar: globale mattrender, nye konsepter og retteforslag.
 */
export function runLunchTrendRadarEngine(
  req: LunchTrendRadarEngineInput
): LunchTrendRadarEngineResult {
  if (req.kind !== "report") {
    throw new Error(
      `Unknown lunch trend radar kind: ${(req as LunchTrendRadarEngineInput).kind}`
    );
  }
  return {
    kind: "report",
    data: getLunchTrendReport(req.input),
  };
}
