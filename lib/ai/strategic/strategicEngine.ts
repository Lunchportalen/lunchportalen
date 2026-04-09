// STATUS: KEEP

/**
 * AI STRATEGIC ENGINE
 * Langsiktig analyse av: marked, produkt, plattformretning.
 * Samler analyzeMarketTrends, generateProductRoadmap, generateStrategicInsights.
 * Kun analyse/plan; ingen mutasjon.
 */

import { analyzeMarketTrends } from "@/lib/ai/engines/capabilities/analyzeMarketTrends";
import type {
  AnalyzeMarketTrendsInput,
  AnalyzeMarketTrendsOutput,
  TrendItem,
  SeriesInput,
  SegmentInput,
} from "@/lib/ai/engines/capabilities/analyzeMarketTrends";
import { generateProductRoadmap } from "@/lib/ai/engines/capabilities/generateProductRoadmap";
import type {
  GenerateProductRoadmapInput,
  GenerateProductRoadmapOutput,
  InitiativeInput,
  RoadmapPhase,
  RoadmapInitiative,
} from "@/lib/ai/engines/capabilities/generateProductRoadmap";
import { generateStrategicInsights } from "@/lib/ai/engines/capabilities/generateStrategicInsights";
import type {
  GenerateStrategicInsightsInput,
  GenerateStrategicInsightsOutput,
  StrategicContextInput,
  StrategicInsight,
} from "@/lib/ai/engines/capabilities/generateStrategicInsights";

export type {
  TrendItem,
  SeriesInput,
  SegmentInput,
  InitiativeInput,
  RoadmapPhase,
  RoadmapInitiative,
  StrategicContextInput,
  StrategicInsight,
};

/** Langsiktig markedanalyse: trender, retning, styrke, innsikter og anbefalinger. */
export function analyzeMarket(input: AnalyzeMarketTrendsInput): AnalyzeMarketTrendsOutput {
  return analyzeMarketTrends(input);
}

/** Langsiktig produktanalyse: roadmap med faser, initiativer og tidslinje. */
export function analyzeProduct(input: GenerateProductRoadmapInput): GenerateProductRoadmapOutput {
  return generateProductRoadmap(input);
}

/** Langsiktig plattformretning: strategiske innsikter fra mål, SWOT og prioriteringer. */
export function analyzePlatformDirection(
  input: GenerateStrategicInsightsInput
): GenerateStrategicInsightsOutput {
  return generateStrategicInsights(input);
}

/** Type for dispatch. */
export type StrategicEngineKind = "market" | "product" | "platform_direction";

export type StrategicEngineInput =
  | { kind: "market"; input?: AnalyzeMarketTrendsInput }
  | { kind: "product"; input: GenerateProductRoadmapInput }
  | { kind: "platform_direction"; input?: GenerateStrategicInsightsInput };

export type StrategicEngineResult =
  | { kind: "market"; data: AnalyzeMarketTrendsOutput }
  | { kind: "product"; data: GenerateProductRoadmapOutput }
  | { kind: "platform_direction"; data: GenerateStrategicInsightsOutput };

/**
 * Samlet dispatch: marked, produkt, plattformretning.
 */
export function runStrategicEngine(req: StrategicEngineInput): StrategicEngineResult {
  switch (req.kind) {
    case "market":
      return { kind: "market", data: analyzeMarket(req.input ?? {}) };
    case "product":
      return { kind: "product", data: analyzeProduct(req.input) };
    case "platform_direction":
      return { kind: "platform_direction", data: analyzePlatformDirection(req.input ?? {}) };
    default:
      throw new Error(`Unknown strategic engine kind: ${(req as StrategicEngineInput).kind}`);
  }
}
