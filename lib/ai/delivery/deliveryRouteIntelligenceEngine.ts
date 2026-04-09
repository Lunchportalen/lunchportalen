/**
 * AI DELIVERY ROUTE INTELLIGENCE ENGINE
 * AI analyserer leveranser og foreslår: mer effektive ruter, bedre leveringsvinduer.
 */

import { suggestRouteAndWindows } from "@/lib/ai/engines/capabilities/deliveryRouteIntelligence";
import type {
  DeliveryRouteIntelligenceInput,
  DeliveryRouteIntelligenceOutput,
  DepotInput,
  DeliveryStopInput,
  SuggestedRouteOutput,
  WindowSuggestion,
} from "@/lib/ai/engines/capabilities/deliveryRouteIntelligence";

export type { DepotInput, DeliveryStopInput, SuggestedRouteOutput, WindowSuggestion };

/** Foreslår mer effektiv rute og bedre leveringsvinduer ut fra stopp og depot. */
export function getDeliveryRouteSuggestions(
  input: DeliveryRouteIntelligenceInput
): DeliveryRouteIntelligenceOutput {
  return suggestRouteAndWindows(input);
}

export type DeliveryRouteIntelligenceEngineKind = "suggest";

export type DeliveryRouteIntelligenceEngineInput = {
  kind: "suggest";
  input: DeliveryRouteIntelligenceInput;
};

export type DeliveryRouteIntelligenceEngineResult = {
  kind: "suggest";
  data: DeliveryRouteIntelligenceOutput;
};

/**
 * Kjører delivery route intelligence: forslag til rute og leveringsvinduer.
 */
export function runDeliveryRouteIntelligenceEngine(
  req: DeliveryRouteIntelligenceEngineInput
): DeliveryRouteIntelligenceEngineResult {
  if (req.kind !== "suggest") {
    throw new Error(
      `Unknown delivery route intelligence kind: ${(req as DeliveryRouteIntelligenceEngineInput).kind}`
    );
  }
  return {
    kind: "suggest",
    data: getDeliveryRouteSuggestions(req.input),
  };
}
