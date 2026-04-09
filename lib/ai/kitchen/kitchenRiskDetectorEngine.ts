/**
 * AI KITCHEN RISK DETECTOR ENGINE
 * Oppdager risiko som: volumspike, forsinkelse, underkapasitet.
 */

import { detectKitchenRisks } from "@/lib/ai/engines/capabilities/kitchenRiskDetector";
import type {
  KitchenRiskDetectorInput,
  KitchenRiskDetectorOutput,
  KitchenSlotInput,
  DetectedKitchenRisk,
  KitchenRiskType,
} from "@/lib/ai/engines/capabilities/kitchenRiskDetector";

export type { KitchenSlotInput, DetectedKitchenRisk, KitchenRiskType };

/** Oppdager kjøkkenrisiko: forsinkelser, volumspikes, underkapasitet. */
export function getKitchenRisks(input: KitchenRiskDetectorInput): KitchenRiskDetectorOutput {
  return detectKitchenRisks(input);
}

export type KitchenRiskDetectorEngineKind = "detect";

export type KitchenRiskDetectorEngineInput = {
  kind: "detect";
  input: KitchenRiskDetectorInput;
};

export type KitchenRiskDetectorEngineResult = {
  kind: "detect";
  data: KitchenRiskDetectorOutput;
};

/**
 * Kjører kitchen risk detector: volumspike, forsinkelse, underkapasitet.
 */
export function runKitchenRiskDetectorEngine(
  req: KitchenRiskDetectorEngineInput
): KitchenRiskDetectorEngineResult {
  if (req.kind !== "detect") {
    throw new Error(
      `Unknown kitchen risk detector kind: ${(req as KitchenRiskDetectorEngineInput).kind}`
    );
  }
  return {
    kind: "detect",
    data: getKitchenRisks(req.input),
  };
}
