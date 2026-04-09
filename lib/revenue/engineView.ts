/**
 * Sammendrag for kontrolltårn — deterministisk, ingen sideeffekter.
 */

import { linkCampaignToRevenue } from "@/lib/ads/linking";
import { enforceDailyLimits } from "@/lib/engine/budget";
import { profitGuard } from "@/lib/engine/guard";
import { optimizeFromRevenue } from "@/lib/engine/optimizer";
import { globalSafety } from "@/lib/engine/safety";
import { scoreAttribution } from "@/lib/revenue/confidence";
import { filterReliableEvents } from "@/lib/revenue/filter";
import type { RevenueEvent } from "@/lib/revenue/unified";

export type CampaignSpendBinding = { id: string; spend: number; budget?: number };

export type RevenueEngineDecisionRow = {
  campaignId: string;
  revenue: number;
  spend: number;
  budgetAfterCap: number;
  optimize: ReturnType<typeof optimizeFromRevenue>;
  guard: ReturnType<typeof profitGuard>;
};

export type RevenueEngineSummary = {
  totalRevenue: number;
  totalSpend: number;
  totalProfit: number;
  marginPct: number | null;
  portfolioRoas: number;
  globalSafety: ReturnType<typeof globalSafety>;
  bestCampaign: { id: string; revenue: number } | null;
  worstCampaign: { id: string; revenue: number } | null;
  decisions: RevenueEngineDecisionRow[];
  /** Sum før attributjonsfilter (kun sporbare hendelser). */
  signalRevenueTotal: number;
  /** Beløp som ikke inngår i profit pga. lav attributjonssikkerhet. */
  excludedWeakAttributionRevenue: number;
  attributionReliabilityLabel: "Høy sikkerhet" | "Lav sikkerhet";
  traceableEventCount: number;
  reliableEventCount: number;
};

function sumAmounts(list: RevenueEvent[]): number {
  return list.reduce((s, e) => s + (Number.isFinite(e.amount) ? Math.max(0, e.amount) : 0), 0);
}

export function summarizeClosedLoopEngine(
  events: RevenueEvent[],
  spendBindings: CampaignSpendBinding[],
): RevenueEngineSummary {
  const evList = Array.isArray(events) ? events : [];
  const normalized: RevenueEvent[] = evList.map((e) => ({
    ...e,
    confidence:
      typeof e.confidence === "number" && Number.isFinite(e.confidence) ? e.confidence : scoreAttribution(e),
  }));
  const signalRevenueTotal = normalized.reduce(
    (s, e) => s + (Number.isFinite(e.amount) ? Math.max(0, e.amount) : 0),
    0,
  );
  const reliableList = filterReliableEvents(normalized);
  const excludedWeakAttributionRevenue = Math.max(0, signalRevenueTotal - sumAmounts(reliableList));
  const attributionReliabilityLabel: "Høy sikkerhet" | "Lav sikkerhet" =
    excludedWeakAttributionRevenue > 1e-6 ? "Lav sikkerhet" : "Høy sikkerhet";

  const totalRevenue = reliableList.reduce((s, e) => s + (Number.isFinite(e.amount) ? Math.max(0, e.amount) : 0), 0);

  const spendMap = new Map<string, number>();
  const budgetMap = new Map<string, number>();
  for (const b of spendBindings) {
    const id = String(b?.id ?? "").trim();
    if (!id) continue;
    const sp = typeof b.spend === "number" && Number.isFinite(b.spend) ? Math.max(0, b.spend) : 0;
    spendMap.set(id, (spendMap.get(id) ?? 0) + sp);
    if (typeof b.budget === "number" && Number.isFinite(b.budget)) {
      budgetMap.set(id, (budgetMap.get(id) ?? 0) + Math.max(0, b.budget));
    }
  }

  const totalSpend = [...spendMap.values()].reduce((s, v) => s + v, 0);
  const totalProfit = totalRevenue - totalSpend;
  const marginPct = totalRevenue > 0 ? (totalRevenue - totalSpend) / totalRevenue : null;
  const portfolioRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const byKey = new Map<string, number>();
  for (const e of reliableList) {
    const k = String(e.campaignId ?? e.postId ?? "").trim();
    if (!k) continue;
    byKey.set(k, (byKey.get(k) ?? 0) + (Number.isFinite(e.amount) ? Math.max(0, e.amount) : 0));
  }

  const ranked = [...byKey.entries()].sort((a, b) => b[1] - a[1]);
  const bestCampaign = ranked[0] ? { id: ranked[0][0], revenue: ranked[0][1] } : null;
  const worstCampaign = ranked.length > 0 ? { id: ranked[ranked.length - 1][0], revenue: ranked[ranked.length - 1][1] } : null;

  const idUniverse = new Set<string>([...byKey.keys(), ...spendMap.keys()]);
  const decisions: RevenueEngineDecisionRow[] = [...idUniverse]
    .sort((a, b) => a.localeCompare(b, "en"))
    .map((campaignId) => {
      const revenue = byKey.get(campaignId) ?? 0;
      const spend = spendMap.get(campaignId) ?? 0;
      const rawBudget = budgetMap.get(campaignId) ?? spend;
      const budgetAfterCap = enforceDailyLimits({ budget: rawBudget });
      const linked = linkCampaignToRevenue({ id: campaignId }, reliableList);
      return {
        campaignId,
        revenue,
        spend,
        budgetAfterCap,
        optimize: optimizeFromRevenue({ spend }, linked),
        guard: profitGuard({ spend }, linked),
      };
    });

  return {
    totalRevenue,
    totalSpend,
    totalProfit,
    marginPct,
    portfolioRoas,
    globalSafety: globalSafety({ roas: portfolioRoas }),
    bestCampaign,
    worstCampaign,
    decisions,
    signalRevenueTotal,
    excludedWeakAttributionRevenue,
    attributionReliabilityLabel,
    traceableEventCount: normalized.length,
    reliableEventCount: reliableList.length,
  };
}
