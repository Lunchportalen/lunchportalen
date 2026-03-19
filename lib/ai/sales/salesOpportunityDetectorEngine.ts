/**
 * AI SALES OPPORTUNITY ENGINE
 * AI identifiserer firmaer som bør: oppgradere plan, øke volum.
 */

import { detectSalesOpportunities } from "@/lib/ai/capabilities/salesOpportunityDetector";
import type {
  SalesOpportunityDetectorInput,
  SalesOpportunityDetectorOutput,
  CompanyUsageInput,
  UpgradeOpportunity,
  SalesOpportunityType,
} from "@/lib/ai/capabilities/salesOpportunityDetector";

export type { CompanyUsageInput, UpgradeOpportunity, SalesOpportunityType };

/** Identifiserer firmaer som bør oppgradere plan eller øke volum. */
export function getSalesOpportunities(
  input: SalesOpportunityDetectorInput
): SalesOpportunityDetectorOutput {
  return detectSalesOpportunities(input);
}

export type SalesOpportunityDetectorEngineKind = "detect";

export type SalesOpportunityDetectorEngineInput = {
  kind: "detect";
  input: SalesOpportunityDetectorInput;
};

export type SalesOpportunityDetectorEngineResult = {
  kind: "detect";
  data: SalesOpportunityDetectorOutput;
};

/**
 * Kjører sales opportunity detector: firmaer som bør få foreslått luksusavtale eller basisavtale.
 */
export function runSalesOpportunityDetectorEngine(
  req: SalesOpportunityDetectorEngineInput
): SalesOpportunityDetectorEngineResult {
  if (req.kind !== "detect") {
    throw new Error(
      `Unknown sales opportunity detector kind: ${(req as SalesOpportunityDetectorEngineInput).kind}`
    );
  }
  return {
    kind: "detect",
    data: getSalesOpportunities(req.input),
  };
}
