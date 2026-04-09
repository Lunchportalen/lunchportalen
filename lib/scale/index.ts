export type { Market, MarketPerformanceResult } from "@/lib/scale/markets";
export { DEFAULT_MARKETS, getMarketPerformance, getMarketDefinition } from "@/lib/scale/markets";

export type { BudgetAllocationResult, BudgetAllocationError } from "@/lib/scale/budget";
export {
  allocateBudget,
  resetBudgetAllocationSnapshot,
  getLastBudgetSnapshot,
  commitBudgetSnapshot,
  computeMarketBudgetScore,
  BUDGET_MIN_SHARE,
  BUDGET_MAX_SHARE,
} from "@/lib/scale/budget";

export type { ReallocateByPerformanceResult } from "@/lib/scale/reallocate";
export { reallocateByPerformance, readDefaultShiftPctFromEnv } from "@/lib/scale/reallocate";

export type { Channel, ScaleChannelId, PickBestChannelResult } from "@/lib/scale/channels";
export {
  SCALE_CHANNEL_IDS,
  SOCIAL_PUBLISH_MODULE,
  SOCIAL_PUBLISH_FN,
  mapPostPlatformToScaleChannel,
  loadTrackedChannels,
  pickBestChannel,
} from "@/lib/scale/channels";
