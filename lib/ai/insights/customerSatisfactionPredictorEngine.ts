/**
 * AI CUSTOMER SATISFACTION PREDICTOR ENGINE
 * AI estimerer hvor fornøyde kunder er basert på: bestillingsmønstre, retter, endringer.
 */

import { predictCustomerSatisfaction } from "@/lib/ai/engines/capabilities/customerSatisfactionPredictor";
import type {
  CustomerSatisfactionPredictorInput,
  CustomerSatisfactionPredictorOutput,
  OrderingPatternInput,
  DishMetricsInput,
  ChangesInput,
  SatisfactionFactor,
} from "@/lib/ai/engines/capabilities/customerSatisfactionPredictor";

export type {
  OrderingPatternInput,
  DishMetricsInput,
  ChangesInput,
  SatisfactionFactor,
};

/** Estimerer kundetilfredshet ut fra bestillingsmønstre, retter og endringer. */
export function predictSatisfaction(
  input: CustomerSatisfactionPredictorInput
): CustomerSatisfactionPredictorOutput {
  return predictCustomerSatisfaction(input);
}

export type CustomerSatisfactionPredictorEngineKind = "predict";

export type CustomerSatisfactionPredictorEngineInput = {
  kind: "predict";
  input: CustomerSatisfactionPredictorInput;
};

export type CustomerSatisfactionPredictorEngineResult = {
  kind: "predict";
  data: CustomerSatisfactionPredictorOutput;
};

/**
 * Kjører customer satisfaction predictor: estimert tilfredshet basert på mønstre, retter og endringer.
 */
export function runCustomerSatisfactionPredictorEngine(
  req: CustomerSatisfactionPredictorEngineInput
): CustomerSatisfactionPredictorEngineResult {
  if (req.kind !== "predict") {
    throw new Error(
      `Unknown customer satisfaction predictor kind: ${(req as CustomerSatisfactionPredictorEngineInput).kind}`
    );
  }
  return {
    kind: "predict",
    data: predictSatisfaction(req.input),
  };
}
