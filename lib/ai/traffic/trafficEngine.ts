/**
 * AI TRAFFIC ENGINE
 * Oppdager: søkeordmuligheter, trafikkmønstre, trend-topics.
 * Samler discoverKeywordGaps, detectTrafficAnomaly, predictOrganicTraffic, detectTrendingTopics.
 * Kun oppdagelse/analyse; ingen mutasjon.
 */

import { discoverKeywordGaps } from "@/lib/ai/capabilities/discoverKeywordGaps";
import type {
  DiscoverKeywordGapsInput,
  DiscoverKeywordGapsOutput,
  KeywordOpportunity,
} from "@/lib/ai/capabilities/discoverKeywordGaps";
import { detectTrafficAnomaly } from "@/lib/ai/capabilities/detectTrafficAnomaly";
import type {
  DetectTrafficAnomalyInput,
  DetectTrafficAnomalyOutput,
  DataPoint,
} from "@/lib/ai/capabilities/detectTrafficAnomaly";
import { predictOrganicTraffic } from "@/lib/ai/capabilities/predictOrganicTraffic";
import type {
  PredictOrganicTrafficInput,
  PredictOrganicTrafficOutput,
  OrganicTrafficDataPoint,
  OrganicTrafficPrediction,
} from "@/lib/ai/capabilities/predictOrganicTraffic";
import { detectTrendingTopics } from "@/lib/ai/capabilities/detectTrendingTopics";
import type {
  DetectTrendingTopicsInput,
  DetectTrendingTopicsOutput,
  TopicDataPoint,
  TrendingTopicResult,
} from "@/lib/ai/capabilities/detectTrendingTopics";

export type { KeywordOpportunity, DataPoint, OrganicTrafficDataPoint, OrganicTrafficPrediction, TopicDataPoint, TrendingTopicResult };

/** Oppdager søkeordmuligheter: hull mellom nåværende og mål/søkefraser (missing, long_tail, question, related). */
export function discoverKeywordOpportunities(input: DiscoverKeywordGapsInput = {}): DiscoverKeywordGapsOutput {
  return discoverKeywordGaps(input);
}

/** Oppdager trafikkavvik: spike eller drop mot baseline (tidsserie). */
export function detectTrafficAnomalies(input: DetectTrafficAnomalyInput): DetectTrafficAnomalyOutput {
  return detectTrafficAnomaly(input);
}

/** Trafikkmønstre: predikerer organisk trafikk fra historikk (trend, vekstrate, fremtidige perioder). */
export function predictTrafficPattern(input: PredictOrganicTrafficInput): PredictOrganicTrafficOutput {
  return predictOrganicTraffic(input);
}

/** Oppdager trend-topics: stigende, synkende eller stabile emner (sammenligning av vinduer). */
export function discoverTrendTopics(input: DetectTrendingTopicsInput): DetectTrendingTopicsOutput {
  return detectTrendingTopics(input);
}

/** Type for dispatch. */
export type TrafficEngineKind =
  | "keyword_opportunities"
  | "traffic_anomaly"
  | "traffic_pattern"
  | "trend_topics";

export type TrafficEngineInput =
  | { kind: "keyword_opportunities"; input?: DiscoverKeywordGapsInput }
  | { kind: "traffic_anomaly"; input: DetectTrafficAnomalyInput }
  | { kind: "traffic_pattern"; input: PredictOrganicTrafficInput }
  | { kind: "trend_topics"; input: DetectTrendingTopicsInput };

export type TrafficEngineResult =
  | { kind: "keyword_opportunities"; data: DiscoverKeywordGapsOutput }
  | { kind: "traffic_anomaly"; data: DetectTrafficAnomalyOutput }
  | { kind: "traffic_pattern"; data: PredictOrganicTrafficOutput }
  | { kind: "trend_topics"; data: DetectTrendingTopicsOutput };

/**
 * Samlet dispatch: søkeordmuligheter, trafikkavvik, trafikkmønster (prediksjon), trend-topics.
 */
export function runTrafficEngine(req: TrafficEngineInput): TrafficEngineResult {
  switch (req.kind) {
    case "keyword_opportunities":
      return { kind: "keyword_opportunities", data: discoverKeywordOpportunities(req.input) };
    case "traffic_anomaly":
      return { kind: "traffic_anomaly", data: detectTrafficAnomalies(req.input) };
    case "traffic_pattern":
      return { kind: "traffic_pattern", data: predictTrafficPattern(req.input) };
    case "trend_topics":
      return { kind: "trend_topics", data: discoverTrendTopics(req.input) };
    default:
      throw new Error(`Unknown traffic engine kind: ${(req as TrafficEngineInput).kind}`);
  }
}
