import "server-only";

export type AgentRole = "CEO" | "CMO" | "CTO" | "COO";

/** Contract from spec — multi-agent output before merge. */
export type AgentDecision = {
  agent: AgentRole;
  action: string;
  priority: number;
  confidence: number;
  reason: string;
  expectedImpact: number;
};

export type AutonomyActionKind = "seo_fix" | "content_improve" | "experiment" | "publish" | "bug_fix";

/** After dedupe / cap — still explainable. */
export type MergedAutonomyDecision = AgentDecision & {
  id: string;
};

export type MappedAutonomyAction = {
  id: string;
  kind: AutonomyActionKind;
  agent: AgentRole;
  label: string;
  description: string;
  confidence: number;
  priority: number;
  reason: string;
  expectedImpact: number;
  /** Target subsystem for humans (no auto wiring). */
  routeHint: "seo_engine" | "ai_content" | "experiments" | "publish_workflow" | "cto_suggestions";
};

export type AutonomyPolicyContext = {
  role: string | null;
  userId: string | null;
  companyId: string | null;
  manualConfirm?: boolean;
  /** Cron / motor: no user UUID. */
  allowSystem?: boolean;
};

export type AutonomyExecutionRecord = {
  decisionId: string;
  ok: boolean;
  detail: string;
};
