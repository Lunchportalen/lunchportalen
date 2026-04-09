/**
 * Read-model dashboard — metrics + insights + latest decision + policy + last automation preview.
 */

import { runAutomation } from "./automationEngine";
import { makeDecision, type DecisionInputData } from "./decisionEngine";
import { evaluatePolicy } from "./policyEngine";
import { generateInsights } from "./insightsEngine";

export type DashboardMetrics = {
  conversionRate: number | null;
  traffic: number | null;
  engagement: number | null;
  revenueProxy: number | null;
};

export type DashboardDecisionRow = {
  decision: ReturnType<typeof makeDecision>;
  policy: ReturnType<typeof evaluatePolicy>;
  automationPreview: ReturnType<typeof runAutomation>;
};

export type DashboardBundle = {
  metrics: DashboardMetrics;
  insights: ReturnType<typeof generateInsights>;
  decisions: DashboardDecisionRow[];
  actions: Array<{ id: string; label: string; safe: boolean }>;
};

const DEFAULT_SEED: DecisionInputData = {
  conversionRate: 0.024,
  traffic: 4200,
  engagementScore: 0.41,
  revenueProxy: 1.08,
  experimentWinRates: [0.62, 0.48, 0.71],
  variantPerformance: [
    { id: "variant_a", lift: 0.04 },
    { id: "variant_b", lift: -0.11 },
  ],
  seoOrganicDelta: -0.03,
  funnelDropRate: 0.38,
};

/**
 * Builds dashboard from optional metric override (e.g. query params → parsed numbers).
 */
export function buildDashboard(override?: Partial<DecisionInputData>): DashboardBundle {
  const data: DecisionInputData = { ...DEFAULT_SEED, ...override };
  const insights = generateInsights(data);
  const decision = makeDecision(data);
  const policy = evaluatePolicy(decision);
  const automationPreview = runAutomation(decision, { mode: "preview" });

  const metrics: DashboardMetrics = {
    conversionRate: typeof data.conversionRate === "number" ? data.conversionRate : null,
    traffic: typeof data.traffic === "number" ? data.traffic : null,
    engagement: typeof data.engagementScore === "number" ? data.engagementScore : null,
    revenueProxy: typeof data.revenueProxy === "number" ? data.revenueProxy : null,
  };

  const actions = [
    { id: "review_decision", label: "Gå gjennom anbefaling og policy", safe: true },
    { id: "run_growth_seo", label: "Åpne growth SEO (manuell)", safe: true },
    { id: "run_funnel", label: "Åpne funnel-analyse (manuell)", safe: true },
  ];

  return {
    metrics,
    insights,
    decisions: [{ decision, policy, automationPreview }],
    actions,
  };
}
