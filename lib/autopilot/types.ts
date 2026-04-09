/**
 * Autonomous growth autopilot — types only (additive).
 */

export type AutopilotOpportunityType = "low_conversion" | "high_bounce" | "thin_traffic" | "low_revenue";

export type AutopilotOpportunity = {
  type: AutopilotOpportunityType;
  /** Deterministic severity 0..1 for ranking. */
  severity: number;
};

export type AutopilotMetrics = {
  posts: number;
  orders: number;
  leads: number;
  sessions: number;
  revenue: number;
  /** orders / max(sessions, 1) — real orders vs session proxy. */
  conversionRate: number;
  /** 1 - min(1, orders / max(session * k, 1)) — bounded proxy, not web analytics bounce. */
  bounceRate: number;
  /** Schema version for reversible log replay. */
  schemaVersion: 1;
};

export type AutopilotExperimentProposal = {
  id: string;
  hypothesis: string;
  opportunity: AutopilotOpportunity;
  version: 1;
  createdAtIso: string;
};
