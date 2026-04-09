/**
 * AI WASTE REDUCTION ENGINE
 * AI analyserer: hva som ikke blir spist, hva som ofte avbestilles, hva som blir igjen –
 * og foreslår menyendringer.
 */

import { suggestMenuChangesForWaste } from "@/lib/ai/engines/capabilities/wasteReduction";
import type {
  WasteReductionInput,
  WasteReductionOutput,
  DishWasteStats,
  MenuChangeSuggestion,
} from "@/lib/ai/engines/capabilities/wasteReduction";

export type { DishWasteStats, MenuChangeSuggestion };

/** Analyserer matsvinnsignaler og foreslår menyendringer. */
export function getWasteReductionSuggestions(
  input: WasteReductionInput
): WasteReductionOutput {
  return suggestMenuChangesForWaste(input);
}

export type WasteReductionEngineKind = "suggest_menu_changes";

export type WasteReductionEngineInput = {
  kind: "suggest_menu_changes";
  input: WasteReductionInput;
};

export type WasteReductionEngineResult = {
  kind: "suggest_menu_changes";
  data: WasteReductionOutput;
};

/**
 * Kjører waste reduction engine: forslag til menyendringer basert på uneaten, avbestillinger og rester.
 */
export function runWasteReductionEngine(
  req: WasteReductionEngineInput
): WasteReductionEngineResult {
  if (req.kind !== "suggest_menu_changes") {
    throw new Error(
      `Unknown waste reduction kind: ${(req as WasteReductionEngineInput).kind}`
    );
  }
  return {
    kind: "suggest_menu_changes",
    data: getWasteReductionSuggestions(req.input),
  };
}
