/**
 * Deterministisk kandidat-scoring basert på priors + faktisk omsetning i hjemmemarked (no).
 * Ingen modell-gjetting — samme input gir samme output.
 */
import { MARKETS, type MarketDef } from "@/lib/global/markets";
import type { MarketPerformanceMap } from "@/lib/global/marketPerformance";

export type MarketScoreRow = {
  market: string;
  score: number;
  reason: string;
};

/** Statiske prioriter (nordisk nærhet, B2B). */
const PRIOR_SCORE: Record<string, number> = {
  se: 0.82,
  dk: 0.76,
};

function reasonFor(marketId: string, boost: number): string {
  const base =
    marketId === "se"
      ? "Nær språk og kultur, høy kjøpekraft (tabellprior)."
      : marketId === "dk"
        ? "Sterk B2B-segment (tabellprior)."
        : "Generell ekspansjonskandidat.";
  if (boost > 0.02) {
    return `${base} Boost: sterk hjemmeomsetning (no) støtter nordisk ekspansjon.`;
  }
  if (boost > 0) {
    return `${base} Lett boost fra hjemmeresultater.`;
  }
  return base;
}

function homeRevenueBoost(performance: MarketPerformanceMap | undefined): number {
  const home = performance?.no;
  const r = home && typeof home.revenue === "number" ? home.revenue : 0;
  if (r >= 50_000) return 0.05;
  if (r >= 10_000) return 0.03;
  if (r >= 1_000) return 0.01;
  return 0;
}

export type ScoreMarketsInput = {
  performance: MarketPerformanceMap;
};

/**
 * Rangerer ikke-åpnede markeder (enabled=false) som kan piloteres.
 * `no` er aldri kandidat for «ny» ekspansjon her.
 */
export function scoreMarkets(baseData: ScoreMarketsInput): MarketScoreRow[] {
  const boost = homeRevenueBoost(baseData.performance);
  const rows: MarketScoreRow[] = [];

  for (const m of MARKETS) {
    if (m.id === "no") continue;
    if (m.enabled === true) continue;
    const prior = PRIOR_SCORE[m.id] ?? 0.55;
    const score = Math.min(1, prior + boost);
    rows.push({
      market: m.id,
      score: Math.round(score * 1000) / 1000,
      reason: reasonFor(m.id, boost),
    });
  }

  return rows.sort((a, b) => b.score - a.score);
}

export function topExpansionCandidate(
  scored: MarketScoreRow[],
  markets: MarketDef[],
): { market: MarketDef; row: MarketScoreRow } | null {
  const top = scored[0];
  if (!top) return null;
  const m = markets.find((x) => x.id === top.market);
  if (!m) return null;
  return { market: m, row: top };
}
