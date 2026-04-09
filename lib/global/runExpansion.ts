/**
 * Global ekspansjonsmotor: data → score → pilot-utkast (maks 1 nytt marked per kjøring) → anbefalinger.
 * Ingen persist av poster — reversibelt ved å ikke publisere utkast.
 */
import "server-only";

import { decideExpansion } from "@/lib/global/decideExpansion";
import { logMarketExpansion } from "@/lib/global/expansionLog";
import { launchPilotMarket, PILOT_MAX_POSTS, type PilotDraftPost } from "@/lib/global/launch";
import { MARKETS } from "@/lib/global/markets";
import type { MarketDef } from "@/lib/global/markets";
import { trackMarketPerformance, type MarketPerformanceMap } from "@/lib/global/marketPerformance";
import { scoreMarkets, topExpansionCandidate, type MarketScoreRow } from "@/lib/global/marketScore";
import { collectRevenueData } from "@/lib/revenue/collect";

/** Maks ett nytt pilotmarked per kjøring (sikkerhetsventil). */
export const MAX_NEW_MARKETS_PER_RUN = 1;

export type RunExpansionEngineResult = {
  scored: MarketScoreRow[];
  performance: MarketPerformanceMap;
  decisions: ReturnType<typeof decideExpansion>;
  candidate: { market: MarketDef; row: MarketScoreRow } | null;
  pilotDrafts: PilotDraftPost[];
  pilotMaxPosts: number;
  safety: {
    newMarketsThisRun: number;
    recommendationOnly: true;
    noPersist: true;
  };
};

export async function runExpansionEngine(rid: string): Promise<RunExpansionEngineResult> {
  const data = await collectRevenueData();
  const performance = trackMarketPerformance(data.posts, data.orders);
  const scored = scoreMarkets({ performance });
  const decisions = decideExpansion(performance);
  const top = topExpansionCandidate(scored, MARKETS);

  if (!top) {
    await logMarketExpansion(rid, {
      market: null,
      pilotDraftCount: 0,
      scoredMarkets: scored.map((s) => s.market),
    });
    return {
      scored,
      performance,
      decisions,
      candidate: null,
      pilotDrafts: [],
      pilotMaxPosts: PILOT_MAX_POSTS,
      safety: { newMarketsThisRun: 0, recommendationOnly: true, noPersist: true },
    };
  }

  const pilotDrafts = await launchPilotMarket(top.market, data.posts);

  await logMarketExpansion(rid, {
    market: top.market.id,
    pilotDraftCount: pilotDrafts.length,
    scoredMarkets: scored.map((s) => s.market),
  });

  return {
    scored,
    performance,
    decisions,
    candidate: top,
    pilotDrafts,
    pilotMaxPosts: PILOT_MAX_POSTS,
    safety: {
      newMarketsThisRun: MAX_NEW_MARKETS_PER_RUN,
      recommendationOnly: true,
      noPersist: true,
    },
  };
}
