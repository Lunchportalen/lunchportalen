export { collectAutopilotMetrics } from "@/lib/autopilot/collectMetrics";
export { getMetrics } from "@/lib/autopilot/metrics";
export type { AutopilotUnifiedMetrics, GetMetricsResult } from "@/lib/autopilot/metrics";
export {
  runAutopilotCycle,
  runAutopilot,
  opportunityToStartConfig,
  collectMetrics,
} from "@/lib/autopilot/engine";
export type { AutopilotCycleResult, AutopilotIntelligence, AutopilotLoopResult } from "@/lib/autopilot/engine";
export { detectOpportunities, detectOpportunity } from "@/lib/autopilot/opportunities";
export { evaluateAndPromote, createVersionFromExperiment } from "@/lib/autopilot/runner";
export { isAutopilotEnabled, disableAutopilot, enableAutopilot, clearAutopilotRuntimeOverride } from "@/lib/autopilot/kill-switch";
export { logAutopilot } from "@/lib/autopilot/log";
export type { AutopilotMetrics, AutopilotOpportunity, AutopilotExperimentProposal } from "@/lib/autopilot/types";
export {
  startExperiment,
  evaluateExperiment,
  reopenExperiment,
  getExperimentById,
  computeDeterministicOutcome,
  hasAnyRunningExperiment,
} from "@/lib/autopilot/experiment";
export type {
  Experiment,
  StartExperimentConfig,
  ExperimentEvaluationMetrics,
} from "@/lib/autopilot/experiment";
export { storeResult, getBestStrategy, getLearningRecordsSnapshot } from "@/lib/autopilot/learning";
export type {
  ExperimentOutcome,
  ExperimentSnapshotForLearning,
  LearningRecord,
  LearningFeedback,
  StrategyPerType,
} from "@/lib/autopilot/learning";
