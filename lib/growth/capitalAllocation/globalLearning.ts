import type { CapitalChannelId } from "@/lib/growth/capitalAllocation/types";

const SCORE_HIGH = 0.72;
const SUGGEST_SHARE = 0.15;

export type TransferSuggestion = {
  fromMarket: string;
  channel: CapitalChannelId;
  targetMarkets: string[];
  suggestedTrafficShare: number;
};

/**
 * If a (market, channel) scores high, suggest cross-market tests at bounded traffic share.
 */
export function buildGlobalTransferSuggestions(args: {
  markets: string[];
  scoresByMarket: Record<string, Record<CapitalChannelId, number>>;
}): TransferSuggestion[] {
  const { markets, scoresByMarket } = args;
  const out: TransferSuggestion[] = [];
  for (const m of markets) {
    const scores = scoresByMarket[m];
    if (!scores) continue;
    for (const ch of Object.keys(scores) as CapitalChannelId[]) {
      if ((scores[ch] ?? 0) < SCORE_HIGH) continue;
      const others = markets.filter((x) => x !== m);
      if (others.length === 0) continue;
      out.push({
        fromMarket: m,
        channel: ch,
        targetMarkets: others,
        suggestedTrafficShare: SUGGEST_SHARE,
      });
    }
  }
  return out;
}
