/**
 * AI PROCUREMENT PLANNER / PROCUREMENT ADVISOR ENGINE
 * AI foreslår innkjøp basert på: prognoser, menyplan, leveringsvolum.
 */

import { suggestProcurement } from "@/lib/ai/capabilities/procurementAdvisor";
import type {
  ProcurementAdvisorInput,
  ProcurementAdvisorOutput,
  ForecastItemInput,
  RawMaterialPriceInput,
  ProcurementSuggestion,
} from "@/lib/ai/capabilities/procurementAdvisor";

export type { ForecastItemInput, RawMaterialPriceInput, ProcurementSuggestion };

/** Foreslår innkjøp ut fra prognoser, menyplan og leveringsvolum. */
export function getProcurementSuggestions(
  input: ProcurementAdvisorInput
): ProcurementAdvisorOutput {
  return suggestProcurement(input);
}

export type ProcurementAdvisorEngineKind = "suggest";

export type ProcurementAdvisorEngineInput = {
  kind: "suggest";
  input: ProcurementAdvisorInput;
};

export type ProcurementAdvisorEngineResult = {
  kind: "suggest";
  data: ProcurementAdvisorOutput;
};

/**
 * Kjører procurement planner: innkjøpsforslag basert på prognoser, menyplan og leveringsvolum.
 */
export function runProcurementAdvisorEngine(
  req: ProcurementAdvisorEngineInput
): ProcurementAdvisorEngineResult {
  if (req.kind !== "suggest") {
    throw new Error(
      `Unknown procurement advisor kind: ${(req as ProcurementAdvisorEngineInput).kind}`
    );
  }
  return {
    kind: "suggest",
    data: getProcurementSuggestions(req.input),
  };
}
