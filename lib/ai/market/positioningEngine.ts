export type MarketPosition = "VALUE_LEADER" | "PREMIUM_POSITION" | "BALANCED_POSITION";

export function determinePosition(
  _ctx: unknown,
  competitorInsights: string[],
): MarketPosition {
  if (competitorInsights.includes("OVERPRICED_MARKET")) {
    return "VALUE_LEADER";
  }
  if (competitorInsights.includes("UNDERPRICED_MARKET")) {
    return "PREMIUM_POSITION";
  }
  return "BALANCED_POSITION";
}
