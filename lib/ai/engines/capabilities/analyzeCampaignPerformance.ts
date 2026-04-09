/**
 * Marketing performance analyzer capability: analyzeCampaignPerformance.
 * Analyzes campaign metrics (impressions, clicks, conversions, spend) and optional goals.
 * Returns performance score, insights, recommendations, and comparison to goals. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "analyzeCampaignPerformance";

const analyzeCampaignPerformanceCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes campaign performance from metrics (impressions, clicks, conversions, spend, revenue) and optional goals. Returns performance score, insights, recommendations, and goal comparison. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Campaign performance analysis input",
    properties: {
      campaignName: { type: "string", description: "Campaign identifier" },
      metrics: {
        type: "object",
        description: "Campaign metrics for the period",
        properties: {
          impressions: { type: "number" },
          clicks: { type: "number" },
          conversions: { type: "number" },
          spend: { type: "number", description: "Total spend (e.g. currency units)" },
          revenue: { type: "number", description: "Optional revenue attributed" },
        },
      },
      goals: {
        type: "object",
        description: "Optional targets to compare against",
        properties: {
          targetCtr: { type: "number", description: "Target CTR 0-1 or 0-100" },
          targetCpa: { type: "number", description: "Target cost per acquisition" },
          targetRoas: { type: "number", description: "Target return on ad spend" },
          targetConversions: { type: "number" },
        },
      },
      periodDays: { type: "number", description: "Analysis period in days" },
      channel: { type: "string", description: "e.g. paid_search, social, email" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["metrics"],
  },
  outputSchema: {
    type: "object",
    description: "Campaign performance analysis result",
    required: ["performanceScore", "insights", "recommendations", "computedMetrics", "summary", "generatedAt"],
    properties: {
      performanceScore: { type: "number", description: "0-100" },
      grade: { type: "string", enum: ["poor", "below", "on_track", "good", "excellent"] },
      insights: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      computedMetrics: {
        type: "object",
        properties: {
          ctr: { type: "number" },
          cpc: { type: "number" },
          cpa: { type: "number" },
          roas: { type: "number" },
        },
      },
      goalComparison: {
        type: "object",
        description: "Met or missed vs goals",
        properties: {
          ctr: { type: "object", properties: { met: { type: "boolean" }, value: { type: "number" }, target: { type: "number" } } },
          cpa: { type: "object", properties: { met: { type: "boolean" }, value: { type: "number" }, target: { type: "number" } } },
          roas: { type: "object", properties: { met: { type: "boolean" }, value: { type: "number" }, target: { type: "number" } } },
          conversions: { type: "object", properties: { met: { type: "boolean" }, value: { type: "number" }, target: { type: "number" } } },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no campaign or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(analyzeCampaignPerformanceCapability);

const CTR_GOOD = 0.03;
const CTR_LOW = 0.01;
const BENCHMARK_CTR = 0.02;

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normPercent(v: number): number {
  return v > 1 ? v / 100 : v;
}

export type CampaignMetricsInput = {
  impressions?: number | null;
  clicks?: number | null;
  conversions?: number | null;
  spend?: number | null;
  revenue?: number | null;
};

export type CampaignGoalsInput = {
  targetCtr?: number | null;
  targetCpa?: number | null;
  targetRoas?: number | null;
  targetConversions?: number | null;
};

export type AnalyzeCampaignPerformanceInput = {
  campaignName?: string | null;
  metrics: CampaignMetricsInput;
  goals?: CampaignGoalsInput | null;
  periodDays?: number | null;
  channel?: string | null;
  locale?: "nb" | "en" | null;
};

export type GoalComparisonItem = { met: boolean; value: number; target: number };

export type AnalyzeCampaignPerformanceOutput = {
  performanceScore: number;
  grade: "poor" | "below" | "on_track" | "good" | "excellent";
  insights: string[];
  recommendations: string[];
  computedMetrics: { ctr: number; cpc: number; cpa: number; roas: number };
  goalComparison: {
    ctr?: GoalComparisonItem;
    cpa?: GoalComparisonItem;
    roas?: GoalComparisonItem;
    conversions?: GoalComparisonItem;
  };
  summary: string;
  generatedAt: string;
};

/**
 * Analyzes campaign performance from metrics and goals. Deterministic; no external calls.
 */
export function analyzeCampaignPerformance(input: AnalyzeCampaignPerformanceInput): AnalyzeCampaignPerformanceOutput {
  const isEn = input.locale === "en";
  const m = input.metrics && typeof input.metrics === "object" ? input.metrics : {};
  const g = input.goals && typeof input.goals === "object" ? input.goals : {};

  const impressions = safeNum(m.impressions);
  const clicks = safeNum(m.clicks);
  const conversions = safeNum(m.conversions);
  const spend = safeNum(m.spend);
  const revenue = safeNum(m.revenue);

  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  const roas = spend > 0 && revenue > 0 ? revenue / spend : 0;

  const computedMetrics = { ctr, cpc, cpa, roas };

  const goalComparison: AnalyzeCampaignPerformanceOutput["goalComparison"] = {};
  const targetCtr = g.targetCtr != null ? normPercent(g.targetCtr) : null;
  const targetCpa = g.targetCpa != null ? safeNum(g.targetCpa) : null;
  const targetRoas = g.targetRoas != null ? safeNum(g.targetRoas) : null;
  const targetConversions = g.targetConversions != null ? safeNum(g.targetConversions) : null;

  if (targetCtr != null) {
    goalComparison.ctr = { met: ctr >= targetCtr, value: ctr, target: targetCtr };
  }
  if (targetCpa != null && targetCpa > 0) {
    goalComparison.cpa = { met: cpa <= targetCpa, value: cpa, target: targetCpa };
  }
  if (targetRoas != null && targetRoas > 0) {
    goalComparison.roas = { met: roas >= targetRoas, value: roas, target: targetRoas };
  }
  if (targetConversions != null) {
    goalComparison.conversions = { met: conversions >= targetConversions, value: conversions, target: targetConversions };
  }

  const insights: string[] = [];
  const recommendations: string[] = [];

  if (impressions > 0) {
    if (ctr >= CTR_GOOD) {
      insights.push(isEn ? "CTR is above typical benchmark; creative or targeting is resonating." : "CTR er over typisk benchmark; kreativ eller målgruppe treffer.");
    } else if (ctr < CTR_LOW && clicks > 0) {
      insights.push(isEn ? "CTR is low; consider refining creative or audience." : "CTR er lav; vurder å justere kreativ eller målgruppe.");
      recommendations.push(isEn ? "Test new headlines or visuals; narrow or broaden audience." : "Test nye overskrifter eller bilder; innsnevre eller utvide målgruppe.");
    }
  }

  if (conversions > 0 && cpa > 0) {
    if (targetCpa != null && cpa <= targetCpa) {
      insights.push(isEn ? "CPA is at or below target." : "CPA er på eller under mål.");
    } else if (targetCpa != null && cpa > targetCpa) {
      insights.push(isEn ? "CPA is above target; review funnel or bids." : "CPA er over mål; vurder funnel eller bud.");
      recommendations.push(isEn ? "Optimize landing page and checkout; consider bid strategy." : "Optimaliser landingsside og kasse; vurder budstrategi.");
    }
  }

  if (revenue > 0 && spend > 0) {
    if (targetRoas != null && roas >= targetRoas) {
      insights.push(isEn ? "ROAS meets or exceeds target." : "ROAS møter eller overgår mål.");
    } else if (targetRoas != null && roas < targetRoas) {
      insights.push(isEn ? "ROAS below target; review attribution and offer." : "ROAS under mål; vurder attribusjon og tilbud.");
    }
  }

  if (impressions > 0 && clicks === 0) {
    insights.push(isEn ? "No clicks despite impressions; ad visibility or relevance may be low." : "Ingen klikk til tross for visninger; synlighet eller relevans kan være lav.");
    recommendations.push(isEn ? "Improve ad relevance and placement." : "Forbedre annonserelevans og plassering.");
  }

  const metCount = Object.values(goalComparison).filter((x) => x?.met).length;
  const goalCount = Object.keys(goalComparison).length;
  const scoreFromGoals = goalCount > 0 ? (metCount / goalCount) * 50 : 50;
  const scoreFromCtr = ctr >= CTR_GOOD ? 20 : ctr >= BENCHMARK_CTR ? 15 : ctr >= CTR_LOW ? 10 : 5;
  const scoreFromVolume = conversions > 0 ? 15 : clicks > 0 ? 10 : 5;
  const performanceScore = Math.min(100, Math.round(scoreFromGoals + scoreFromCtr + scoreFromVolume));

  let grade: AnalyzeCampaignPerformanceOutput["grade"] = "on_track";
  if (performanceScore >= 85) grade = "excellent";
  else if (performanceScore >= 70) grade = "good";
  else if (performanceScore >= 50) grade = "on_track";
  else if (performanceScore >= 35) grade = "below";
  else grade = "poor";

  const summary = isEn
    ? `Campaign performance: ${grade} (score ${performanceScore}/100). ${insights.length} insight(s), ${recommendations.length} recommendation(s).`
    : `Kampanjeprestasjon: ${grade} (score ${performanceScore}/100). ${insights.length} innsikt(er), ${recommendations.length} anbefaling(er).`;

  return {
    performanceScore,
    grade,
    insights,
    recommendations,
    computedMetrics,
    goalComparison,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { analyzeCampaignPerformanceCapability, CAPABILITY_NAME };
