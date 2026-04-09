/**
 * AI DELIVERY INTELLIGENCE ENGINE
 * Optimaliserer leveringsplan: ruter, tidsvinduer, prioritering.
 */

import { optimizeDeliveryPlan } from "@/lib/ai/engines/capabilities/deliveryIntelligence";
import type {
  DeliveryIntelligenceInput,
  DeliveryIntelligenceOutput,
  DeliveryDepotInput,
  DeliveryIntelligenceStopInput,
  DeliveryWindowInput,
  SuggestedDeliveryRoute,
  TimeWindowSuggestion,
  StopPrioritization,
} from "@/lib/ai/engines/capabilities/deliveryIntelligence";

export type {
  DeliveryDepotInput,
  DeliveryIntelligenceStopInput,
  DeliveryWindowInput,
  SuggestedDeliveryRoute,
  TimeWindowSuggestion,
  StopPrioritization,
};

/** Optimaliserer leveringsplan: rute, tidsvinduer, prioritering. */
export function optimizePlan(input: DeliveryIntelligenceInput): DeliveryIntelligenceOutput {
  return optimizeDeliveryPlan(input);
}

export type DeliveryIntelligenceEngineKind = "optimize";

export type DeliveryIntelligenceEngineInput = {
  kind: "optimize";
  input: DeliveryIntelligenceInput;
};

export type DeliveryIntelligenceEngineResult = {
  kind: "optimize";
  data: DeliveryIntelligenceOutput;
};

/**
 * Kjører delivery intelligence: optimalisert rute, tidsvinduer og prioritering.
 */
export function runDeliveryIntelligenceEngine(
  req: DeliveryIntelligenceEngineInput
): DeliveryIntelligenceEngineResult {
  if (req.kind !== "optimize") {
    throw new Error(
      `Unknown delivery intelligence kind: ${(req as DeliveryIntelligenceEngineInput).kind}`
    );
  }
  return {
    kind: "optimize",
    data: optimizePlan(req.input),
  };
}
