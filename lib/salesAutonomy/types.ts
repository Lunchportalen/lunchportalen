import type { EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";

export type AutonomyMode = "dry-run" | "semi" | "full";

export type AutonomyRuntimeConfig = {
  enabled: boolean;
  mode: AutonomyMode;
  maxEmailsPerDay: number;
  maxActionsPerRun: number;
  requireApproval: boolean;
};

export type AutonomyPreparedAction = {
  id: string;
  type: "trigger_outreach" | "send_followups" | "observe";
  approved: boolean;
  risk: "low" | "medium" | "high";
  deals: EnrichedPipelineDeal[];
};

export type AutonomyResultItem = {
  id: string;
  type: string;
  status: "blocked" | "executed" | "failed" | "skipped" | "simulated";
  reason?: string;
  simulated?: boolean;
  result?: string;
};

export type AutonomousRunOutput = {
  simulated: boolean;
  config: AutonomyRuntimeConfig;
  prepared: AutonomyPreparedAction[];
  results: AutonomyResultItem[];
  envUnlocked: boolean;
};
