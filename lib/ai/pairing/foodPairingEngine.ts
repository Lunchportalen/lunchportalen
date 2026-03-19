/**
 * AI FOOD PAIRING ENGINE
 * AI foreslår hva som passer sammen i menyen.
 * Eksempel: Thai curry → mango salad → kokosdessert.
 */

import { suggestMenuPairings } from "@/lib/ai/capabilities/foodPairing";
import type {
  FoodPairingInput,
  FoodPairingOutput,
  MenuPairingSuggestion,
} from "@/lib/ai/capabilities/foodPairing";

export type { MenuPairingSuggestion };

/** Foreslår hva som passer sammen på menyen (hovedrett, tilbehør, dessert). */
export function getMenuPairingSuggestions(input: FoodPairingInput): FoodPairingOutput {
  return suggestMenuPairings(input);
}

export type FoodPairingEngineKind = "suggest";

export type FoodPairingEngineInput = {
  kind: "suggest";
  input: FoodPairingInput;
};

export type FoodPairingEngineResult = {
  kind: "suggest";
  data: FoodPairingOutput;
};

/**
 * Kjører food pairing engine: forslag til meny som henger sammen (main → sides → dessert).
 */
export function runFoodPairingEngine(
  req: FoodPairingEngineInput
): FoodPairingEngineResult {
  if (req.kind !== "suggest") {
    throw new Error(
      `Unknown food pairing kind: ${(req as FoodPairingEngineInput).kind}`
    );
  }
  return {
    kind: "suggest",
    data: getMenuPairingSuggestions(req.input),
  };
}
