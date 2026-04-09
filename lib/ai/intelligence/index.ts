/**
 * Unified intelligence layer — one store (`logEvent` / `getEvents`), signals, trends, learning, query, read-model.
 */

export type {
  IntelligenceDomainType,
  IntelligenceEvent,
  IntelligenceEventInsert,
  IntelligenceTrends,
  LearningHistoryItem,
  LogEventInput,
  PublicSystemSignals,
  SystemIntelligence,
} from "./types";

export {
  validateEvent,
  validatePersistedIntelligenceEvent,
  IntelligenceSchemaValidationError,
  IntelligenceStoreFetchError,
  logIntelligenceValidationFailure,
} from "@/lib/ai/schema";

export {
  appendIntelligenceEvent,
  coerceDbTypeToDomain,
  dbRowToIntelligenceEvent,
  expandDomainTypesForQuery,
  getEvents,
  logEvent,
  listIntelligenceEvents,
} from "./store";
export type { AppendIntelligenceEventResult, GetEventsFilter, ListIntelligenceEventsOpts, LogEventResult } from "./store";

export { computeSystemSignals, deriveSystemSignalsFromEvents, humanizeBestSpacing, bestChannelFromMessages } from "./signals";
export type { ComputeSystemSignalsOpts } from "./signals";

export { getSystemIntelligence } from "./systemIntelligence";
export type { GetSystemIntelligenceOpts } from "./systemIntelligence";

export { recordLearningOutcome, getRecentLearningHistory, extractLearningHistory } from "./learning";
export type { RecordLearningOutcomeInput } from "./learning";

export { deriveTrendsFromEvents } from "./trends";

export { answerIntelligenceQuestion } from "./query";
export type { IntelligenceQueryAnswer } from "./query";

export {
  detectWinningPatterns,
  detectWinningPatternsFromEvents,
  detectPatternsFromSystemIntelligence,
} from "./patterns";
export type {
  DetectedPatternRow,
  DetectedWinningPatterns,
  DetectWinningPatternsOpts,
  PatternAxisResult,
  PatternDetectionOutput,
} from "./patterns";

export { refineScaleConfidence, SCALE_MIN_EVENTS, SCALE_MIN_RATE_DELTA } from "./confidence";
export type { ConfidenceRefinementInput } from "./confidence";

export { buildScaleActionsFromPatterns, SCALE_DECISION_THRESHOLD } from "./scaleDecision";
export type { ScaleAction, ScaleActionKind } from "./scaleDecision";

export {
  assertScaleCooldown,
  dedupeAndCapScaleActions,
  filterAllowedScaleActions,
  gateScaleActionsWithPolicy,
  decisionFromScaleAction,
  SCALE_COOLDOWN_MS,
} from "./scalePolicy";
export type { PolicyGatedScaleAction } from "./scalePolicy";

export { buildDesignPatchFromScaleActions, executeScaleActions, rollbackScaleDesign } from "./scaleApply";
export type { AiScalePreferences, ExecuteScaleActionsResult } from "./scaleApply";

export {
  runControlledScaleEngine,
  runScaleEngine,
  scaleEngineToControlTowerMetadata,
  shouldRollbackScale,
  SCALE_HIGH_CONFIDENCE,
  SCALE_MAX_CHANGES,
  SCALE_AUTO_DESIGN_THRESHOLD,
} from "./scale";
export type {
  ControlledScaleInput,
  ControlledScaleResult,
  ScaleEngineInput,
  ScaleEngineMode,
  ScaleEngineResult,
  ScaleProposalLegacy,
} from "./scale";
