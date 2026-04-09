/**
 * Strict intelligence schema layer — single import surface for validators + types.
 */

export {
  INTELLIGENCE_DOMAIN_TYPES,
  IntelligenceDomainTypeSchema,
  IntelligenceEventSchema,
  LogEventInputSchema,
} from "./events";
export type {
  IntelligenceDomainType,
  IntelligenceEventValidated,
  LogEventInputValidated,
} from "./events";

export {
  DesignOptimizerApplyPayloadSchema,
  EditorMetricPayloadSchema,
  ExperimentCompletedPayloadSchema,
  GtmConversionIntelPayloadSchema,
  GtmLeadPayloadSchema,
  GtmOutcomePayloadSchema,
  GtmOutreachSentPayloadSchema,
  GtmReplyClassificationSchema,
  INTELLIGENCE_PAYLOAD_KINDS,
  LearningPairPayloadSchema,
  PatternScalePayloadSchema,
  PolicyDecisionPayloadSchema,
  RevenueEventPayloadSchema,
  RevenueInsightsPayloadSchema,
  ScaleActionPayloadSchema,
  ScaleIgnorePayloadSchema,
  ScaleRollbackPayloadSchema,
} from "./payloads";
export type { IntelligencePayloadKind } from "./payloads";

export { validateEvent, validatePersistedIntelligenceEvent } from "./validate";

export {
  IntelligenceSchemaValidationError,
  IntelligenceStoreFetchError,
  logIntelligenceValidationFailure,
} from "./errors";
