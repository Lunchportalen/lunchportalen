/**
 * Product strategy — explainable, data-driven backlog (no auto-implementation).
 */

export type FunnelStage = "click_to_lead" | "lead_to_order" | "reliability";

export type BottleneckIssue = {
  type: "conversion" | "sales" | "reliability";
  stage: FunnelStage;
  severity: "high" | "medium" | "low";
  message: string;
  /** Explainable signals (numbers, not black box). */
  metrics: Record<string, number>;
};

export type StrategyAction = {
  action: string;
  reason: string;
  impactEstimate: number;
  effort: "low" | "medium" | "high";
  formula: string;
  issueStage: FunnelStage | "unknown";
  severity: "high" | "medium" | "low";
  /** Human approval — no automatic work. */
  approvalRequired: true;
};

export type RoadmapItem = {
  priority: number;
  action: string;
  impactEstimate: number;
  effort: "low" | "medium" | "high";
  reason: string;
  formula: string;
};
