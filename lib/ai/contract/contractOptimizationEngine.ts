/**
 * AI CONTRACT INTELLIGENCE / PRICING INSIGHT / CONTRACT OPTIMIZATION ENGINE
 * Analyserer kontrakter og bruksmønster for å foreslå bedre avtalestruktur.
 */

import { suggestContractOptimizations } from "@/lib/ai/capabilities/contractOptimization";
import type {
  ContractOptimizationInput,
  ContractOptimizationOutput,
  PriceStructureSuggestion,
  RecommendedLevelOutput,
  OptimalDeliveryOutput,
  PriceStructureType,
  AgreementLevel,
} from "@/lib/ai/capabilities/contractOptimization";

export type {
  PriceStructureType,
  AgreementLevel,
  PriceStructureSuggestion,
  RecommendedLevelOutput,
  OptimalDeliveryOutput,
};

/** Analyserer kontrakter og bruksmønster og foreslår bedre avtalestruktur (nivå, prising, leveringsfrekvens). */
export function getContractOptimizationSuggestions(
  input: ContractOptimizationInput
): ContractOptimizationOutput {
  return suggestContractOptimizations(input);
}

export type ContractOptimizationEngineKind = "optimize";

export type ContractOptimizationEngineInput = {
  kind: "optimize";
  input: ContractOptimizationInput;
};

export type ContractOptimizationEngineResult = {
  kind: "optimize";
  data: ContractOptimizationOutput;
};

/**
 * Kjører contract optimization engine: forslag til prisstruktur, nivå (basis/luksus) og leveringsfrekvens.
 */
export function runContractOptimizationEngine(
  req: ContractOptimizationEngineInput
): ContractOptimizationEngineResult {
  if (req.kind !== "optimize") {
    throw new Error(
      `Unknown contract optimization kind: ${(req as ContractOptimizationEngineInput).kind}`
    );
  }
  return {
    kind: "optimize",
    data: getContractOptimizationSuggestions(req.input),
  };
}
