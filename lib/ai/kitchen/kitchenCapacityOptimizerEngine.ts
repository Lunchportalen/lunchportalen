/**
 * AI KITCHEN CAPACITY OPTIMIZER ENGINE
 * AI sørger for at kjøkkenet ikke overbelastes.
 * Kan foreslå: endret leveringsvindu, volumjustering.
 */

import { optimizeKitchenCapacity } from "@/lib/ai/engines/capabilities/kitchenCapacityOptimizer";
import type {
  KitchenCapacityOptimizerInput,
  KitchenCapacityOptimizerOutput,
  CapacitySlotInput,
  AlternativeWindowInput,
  DeliveryWindowSuggestion,
  VolumeAdjustment,
} from "@/lib/ai/engines/capabilities/kitchenCapacityOptimizer";

export type {
  CapacitySlotInput,
  AlternativeWindowInput,
  DeliveryWindowSuggestion,
  VolumeAdjustment,
};

/** Foreslår endret leveringsvindu og volumjustering for å unngå overbelastning. */
export function optimizeCapacity(
  input: KitchenCapacityOptimizerInput
): KitchenCapacityOptimizerOutput {
  return optimizeKitchenCapacity(input);
}

export type KitchenCapacityOptimizerEngineKind = "optimize";

export type KitchenCapacityOptimizerEngineInput = {
  kind: "optimize";
  input: KitchenCapacityOptimizerInput;
};

export type KitchenCapacityOptimizerEngineResult = {
  kind: "optimize";
  data: KitchenCapacityOptimizerOutput;
};

/**
 * Kjører kitchen capacity optimizer: forslag til leveringsvindu og volumjustering.
 */
export function runKitchenCapacityOptimizerEngine(
  req: KitchenCapacityOptimizerEngineInput
): KitchenCapacityOptimizerEngineResult {
  if (req.kind !== "optimize") {
    throw new Error(
      `Unknown kitchen capacity optimizer kind: ${(req as KitchenCapacityOptimizerEngineInput).kind}`
    );
  }
  return {
    kind: "optimize",
    data: optimizeCapacity(req.input),
  };
}
