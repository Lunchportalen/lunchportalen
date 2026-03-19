/**
 * AI CUSTOMER INSIGHT ENGINE
 * AI lager automatiske innsiktsrapporter: mest populære retter, endringer i preferanser, sesongmønstre.
 */

import { generateInsightReport } from "@/lib/ai/capabilities/customerInsight";
import type {
  CustomerInsightInput,
  CustomerInsightOutput,
  DishOrderEntry,
  SeasonOrdersInput,
  PopularDishItem,
  PreferenceChangeItem,
  SeasonalPatternItem,
} from "@/lib/ai/capabilities/customerInsight";

export type {
  DishOrderEntry,
  SeasonOrdersInput,
  PopularDishItem,
  PreferenceChangeItem,
  SeasonalPatternItem,
};

/** Genererer automatisk kundeinnsiktsrapport: populære retter, preferanseendringer, sesongmønstre. */
export function getCustomerInsightReport(
  input: CustomerInsightInput
): CustomerInsightOutput {
  return generateInsightReport(input);
}

export type CustomerInsightEngineKind = "report";

export type CustomerInsightEngineInput = {
  kind: "report";
  input: CustomerInsightInput;
};

export type CustomerInsightEngineResult = {
  kind: "report";
  data: CustomerInsightOutput;
};

/**
 * Kjører customer insight engine: automatisk innsiktsrapport.
 */
export function runCustomerInsightEngine(
  req: CustomerInsightEngineInput
): CustomerInsightEngineResult {
  if (req.kind !== "report") {
    throw new Error(
      `Unknown customer insight kind: ${(req as CustomerInsightEngineInput).kind}`
    );
  }
  return {
    kind: "report",
    data: getCustomerInsightReport(req.input),
  };
}
