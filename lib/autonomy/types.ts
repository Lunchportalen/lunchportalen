import type { PostMetricsInput } from "@/lib/experiment/hypothesis";
import type { RoadmapItem } from "@/lib/strategy/types";

export type { RoadmapItem };

export type AutonomyMode = "dry-run" | "semi" | "auto";

export type MappedActionType = "adjust_sequence" | "update_copy" | "retry_jobs" | "observe";

export type MappedAutonomyAction = {
  /** Stable id for idempotency / approval. */
  id: string;
  type: MappedActionType;
  safe: boolean;
  requiresApproval: boolean;
  sourceRoadmapPriority: number;
  sourceAction: string;
  reason: string;
};

export type ExecutionResult = MappedAutonomyAction & {
  status: "executed" | "blocked" | "failed" | "would_execute" | "skipped";
  detail?: string;
};

/**
 * Optional growth experiment context: versioned CMS preview + ai_experiments row.
 * Requires explicit pageId + companyId (AI entitlements); userId defaults to actor.
 */
export type AutonomyGrowthInput = {
  pageId: string;
  companyId: string;
  userId?: string;
  locale?: string;
  /** Valgfritt: styrer hypotese + variant-generering (deterministisk før LLM). */
  postMetrics?: PostMetricsInput;
};

export type AutonomyRunInput = {
  windowDays?: number;
  /** Explicit approval for risky types (e.g. adjust_sequence, update_copy). */
  approvedActionTypes?: readonly MappedActionType[];
  /** Force dry-run for this invocation (does not change stored config). */
  forceDryRun?: boolean;
  growth?: AutonomyGrowthInput;
  /** Caller profile id (page_versions / audit). */
  actorUserId?: string | null;
};

/** «Forretningsmotor»-lag (simulering / policy) — adskilt fra kartlagte RC-autonomi-handlinger over. */
export type AutonomousActionType =
  | "ads_adjust"
  | "pricing_adjust"
  | "procurement_suggest"
  | "content_generate"
  | "video_generate";

export type AutonomousAction = {
  type: AutonomousActionType;
  reason: string;
  expectedProfit: number;
  riskLevel: "low" | "medium" | "high";
  payload?: Record<string, unknown>;
};

export type BusinessContext = {
  dataComplete: boolean;
  dailySpend?: number;
  totalSpend?: number;
  roas?: number | null;
  margin?: number | null;
  signals?: Record<string, boolean>;
};

export type AutonomousRunMode = "dry_run" | "live";

export type ActionExecutionResult = {
  actionType: AutonomousActionType;
  status: string;
  reason?: string;
  message?: string;
};

export type AutonomousRunResult = {
  mode: AutonomousRunMode;
  capState: "freeze_ads" | "stop_scaling" | "ok";
  policyEnabled: boolean;
  actionsGenerated: number;
  executed: ActionExecutionResult[];
  blocked: Array<{ actionType: AutonomousActionType; reason: string }>;
  explain: Array<{
    actionType: AutonomousActionType;
    reason: string;
    expectedImpact: number;
    risk: AutonomousAction["riskLevel"];
  }>;
};
