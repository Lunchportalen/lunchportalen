export { countEmotionalWords, detectFormat, extractSignals, type ExtractedSignals, type MarketPostLike } from "@/lib/market/signalExtract";

/**
 * Grovt makrosignal — ikke konkurrentdata; brukes i global koordinering.
 */
export function getMarketSignals(): { competition: string; demand: string } {
  return {
    competition: "medium",
    demand: "high",
  };
}
