/**
 * AI PLATFORM INTELLIGENCE ENGINE
 * Samler alle data i én modell og gir: strategiske anbefalinger, vekstmuligheter.
 * Selve hjernen i systemet.
 */

import { runPlatformIntelligence } from "@/lib/ai/engines/capabilities/platformIntelligence";
import type {
  PlatformModelInput,
  PlatformIntelligenceOutput,
  StrategicRecommendation,
  GrowthOpportunity,
} from "@/lib/ai/engines/capabilities/platformIntelligence";

export type {
  PlatformModelInput,
  StrategicRecommendation,
  GrowthOpportunity,
};

/** Kjører plattformintelligens: én modell, strategiske anbefalinger og vekstmuligheter. */
export function getPlatformIntelligence(
  input: PlatformModelInput
): PlatformIntelligenceOutput {
  return runPlatformIntelligence(input);
}

export type PlatformIntelligenceEngineKind = "run";

export type PlatformIntelligenceEngineInput = {
  kind: "run";
  input: PlatformModelInput;
};

export type PlatformIntelligenceEngineResult = {
  kind: "run";
  data: PlatformIntelligenceOutput;
};

/**
 * Kjører platform intelligence: selve hjernen i systemet.
 */
export function runPlatformIntelligenceEngine(
  req: PlatformIntelligenceEngineInput
): PlatformIntelligenceEngineResult {
  if (req.kind !== "run") {
    throw new Error(
      `Unknown platform intelligence kind: ${(req as PlatformIntelligenceEngineInput).kind}`
    );
  }
  return {
    kind: "run",
    data: getPlatformIntelligence(req.input),
  };
}
