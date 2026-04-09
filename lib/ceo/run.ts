import type { CeoInsight, AnalyzeBusinessInput } from "@/lib/ceo/engine";
import { analyzeBusiness } from "@/lib/ceo/engine";
import type { CeoOpportunity } from "@/lib/ceo/opportunities";
import { findOpportunities } from "@/lib/ceo/opportunities";
import type { CeoAction } from "@/lib/ceo/actions";
import { generateActions } from "@/lib/ceo/actions";

const severityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };

function sortInsights(insights: CeoInsight[]): CeoInsight[] {
  return [...insights].sort((a, b) => {
    const sr = (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);
    if (sr !== 0) return sr;
    return (b.revenueImpactKr ?? 0) - (a.revenueImpactKr ?? 0);
  });
}

function sortOpportunities(opportunities: CeoOpportunity[]): CeoOpportunity[] {
  return [...opportunities].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (b.revenueImpactKr ?? 0) - (a.revenueImpactKr ?? 0);
  });
}

export type CeoEngineRunResult = {
  insights: CeoInsight[];
  opportunities: CeoOpportunity[];
  actions: CeoAction[];
};

/**
 * Kjør hele CEO-motoren deterministisk (ingen nettverk / DB).
 */
export function runCeoEngine(data: AnalyzeBusinessInput): CeoEngineRunResult {
  const rawInsights = analyzeBusiness(data);
  const rawOpportunities = findOpportunities(data.pipeline);
  const actions = generateActions(rawOpportunities);
  return {
    insights: sortInsights(rawInsights),
    opportunities: sortOpportunities(rawOpportunities),
    actions,
  };
}
