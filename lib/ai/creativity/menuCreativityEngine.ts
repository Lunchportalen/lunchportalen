/**
 * AI MENU CREATIVITY ENGINE
 * AI genererer nye retter basert på: trender, sesong, kjøkkenets kapasitet.
 */

import { suggestNewDishes } from "@/lib/ai/capabilities/menuCreativity";
import type {
  MenuCreativityInput,
  MenuCreativityOutput,
  NewDishSuggestion,
  Season,
  KitchenCapacity,
} from "@/lib/ai/capabilities/menuCreativity";

export type { Season, KitchenCapacity, NewDishSuggestion };

/** Genererer forslag til nye retter ut fra trender, sesong og kapasitet. */
export function getNewDishSuggestions(input: MenuCreativityInput): MenuCreativityOutput {
  return suggestNewDishes(input);
}

export type MenuCreativityEngineKind = "suggest";

export type MenuCreativityEngineInput = {
  kind: "suggest";
  input: MenuCreativityInput;
};

export type MenuCreativityEngineResult = {
  kind: "suggest";
  data: MenuCreativityOutput;
};

/**
 * Kjører menu creativity engine: nye retteforslag basert på trender, sesong og kjøkkenkapasitet.
 */
export function runMenuCreativityEngine(
  req: MenuCreativityEngineInput
): MenuCreativityEngineResult {
  if (req.kind !== "suggest") {
    throw new Error(
      `Unknown menu creativity kind: ${(req as MenuCreativityEngineInput).kind}`
    );
  }
  return {
    kind: "suggest",
    data: getNewDishSuggestions(req.input),
  };
}
