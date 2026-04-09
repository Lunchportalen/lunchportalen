// STATUS: KEEP

/**
 * Product Operating System — orchestration layer (AI + CMS + design tokens + growth signals).
 * Extend-only: callers compose existing engines; no duplicate business logic.
 */

export type { ProductSurface, ProductSurfaceConfig } from "@/lib/pos/surfaceRegistry";
export {
  PRODUCT_SURFACES,
  designTokensPromptFragment,
  getCmsDesignTokens,
  getProductSurfaceConfig,
  listProductSurfaceConfigs,
  productSurfaceToCmsSurface,
} from "@/lib/pos/surfaceRegistry";

export { collectSignals } from "@/lib/pos/signalCollector";
export type { PosUnifiedSignals, PosSignalCollectionContext } from "@/lib/pos/signalCollector";

export { routeDecisions } from "@/lib/pos/decisionRouter";
export type { PosRoutedDecision, PosActionVerb } from "@/lib/pos/decisionRouter";

export { routeExecution, getPosDesignSystemSnapshot } from "@/lib/pos/executionRouter";
export type { PosExecutionIntent, PosExecutionKind } from "@/lib/pos/executionRouter";

export { routeLearning, buildExperimentLearningInput } from "@/lib/pos/learningRouter";
export type { PosLearningContext, PosLearningRouteResult } from "@/lib/pos/learningRouter";

export { proposeCrossSurfaceRollouts, ctaWinDefaultCmsTargets } from "@/lib/pos/crossSurfaceLearning";
export type { CrossSurfacePromotion } from "@/lib/pos/crossSurfaceLearning";

export { runPOSCycle } from "@/lib/pos/orchestrator";
export type { PosCycleContext, PosCycleResult } from "@/lib/pos/orchestrator";

export type {
  PosEvent,
  PosEventAiUsageUpdated,
  PosEventCmsContentChanged,
  PosEventSignupCompleted,
  PosEventType,
  PosEventVariantPerformanceUpdated,
} from "@/lib/pos/events";
export { POS_EVENT_TYPES } from "@/lib/pos/events";

export { onEvent, __resetPosEventHandlerForTests } from "@/lib/pos/eventHandler";
