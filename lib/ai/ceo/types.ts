import "server-only";

export type CeoDecisionType = "seo_fix" | "content_improve" | "experiment" | "publish";

export type CeoPriority = "high" | "medium" | "low";

export type CeoDecision = {
  type: CeoDecisionType;
  priority: CeoPriority;
  confidence: number;
  reason: string;
  expectedImpact: number;
};

export type CeoGrowthAction = {
  id: string;
  decisionType: CeoDecisionType;
  label: string;
  description: string;
  confidence: number;
};

export type CeoPolicyContext = {
  role: string | null;
  userId: string | null;
  companyId: string | null;
  /** Cron / motor: no end-user id; policy allows log-only path when role is superadmin. */
  allowSystem?: boolean;
};

export type CeoExecutionRecord = {
  actionId: string;
  ok: boolean;
  detail: string;
};

export type SystemSignalsSnapshot = {
  analyticsEvents24h: number;
  pageViews24h: number;
  ctaClicks24h: number;
  runningExperiments: number;
  draftPages: number;
  /** Profit proxies from {@link calculateProfitFromMetrics} — optional when metrics fail. */
  profitMargin?: number;
  profitPerCustomerProxy?: number;
  profitSignal?: "strong" | "neutral" | "weak";
  profitExplain?: string[];
  /** Cross-system intelligence (GTM + revenue + design + experiments) — same read-model as {@link getSystemIntelligence}. */
  unifiedIntelligence?: {
    signals: {
      topCTA: string;
      bestSpacing: string;
      bestChannel: string;
      bestIndustry: string;
    };
    trends?: {
      risingConversions: boolean;
      fallingPerformance: boolean;
      anomalies: string[];
      explain: string[];
    };
    eventCounts: Record<string, number>;
    topPatterns: Array<{ key: string; weight: number }>;
  };
};
