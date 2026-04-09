export type { Competitor, CompetitorEvidence, CompetitorScoreResult } from "@/lib/domination/competitors";
export {
  scoreCompetitor,
  upsertCompetitor,
  getCompetitor,
  listCompetitors,
  removeCompetitor,
  clearCompetitors,
} from "@/lib/domination/competitors";

export type {
  MarketGapFinding,
  MarketGapImpact,
  OwnPerformanceSignals,
} from "@/lib/domination/marketGaps";
export { detectMarketGaps } from "@/lib/domination/marketGaps";

export type { ActionTier, RecommendedGapAction } from "@/lib/domination/gapActions";
export {
  mapGapToAction,
  prioritizeRecommendedActions,
  recommendActionsFromGaps,
} from "@/lib/domination/gapActions";

export type { DominationRunRecord, RankedCompetitor } from "@/lib/domination/engine";
export {
  MAX_ACTIONS_PER_RUN,
  clearDominationLog,
  detectGaps,
  generateActions,
  getCompetitors,
  getDominationLog,
  getDominationSnapshot,
  getLastDominationRun,
  runDomination,
} from "@/lib/domination/engine";
