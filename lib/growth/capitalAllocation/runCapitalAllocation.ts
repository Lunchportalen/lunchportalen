import "server-only";

import {
  ALLOCATION_ACTION,
  loadLastAllocationSnapshots,
  logAllocationUpdate,
} from "@/lib/growth/capitalAllocation/allocationLog";
import { aggregateMarketChannelMetrics } from "@/lib/growth/capitalAllocation/aggregate";
import { boundedOneStep, uniformWeights } from "@/lib/growth/capitalAllocation/boundedReallocate";
import { explorationBandFromMarketSessions, stepScaleForBand } from "@/lib/growth/capitalAllocation/explorationBand";
import { buildGlobalTransferSuggestions } from "@/lib/growth/capitalAllocation/globalLearning";
import { shouldRollback } from "@/lib/growth/capitalAllocation/guards";
import { marketSnapshotFromRaw } from "@/lib/growth/capitalAllocation/marketSnapshot";
import { listConfiguredMarkets } from "@/lib/growth/capitalAllocation/markets";
import { normalizeAndScorePerMarket } from "@/lib/growth/capitalAllocation/normalizeAndScore";
import type { CapitalChannelId, RawMarketChannelMetrics } from "@/lib/growth/capitalAllocation/types";
import { CAPITAL_CHANNELS } from "@/lib/growth/capitalAllocation/types";
import { buildVariantScoreRows } from "@/lib/growth/aggregateGrowth";
import { loadActiveExperimentVariants } from "@/lib/growth/abAssign";
import { pickWinner } from "@/lib/growth/winner";
import { opsLog } from "@/lib/ops/log";
import { collectRevenueData } from "@/lib/revenue/collect";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "capital_allocation_run";

export type CapitalMarketResult = {
  market: string;
  explorationBand: "low" | "medium" | "high";
  channelMetrics: Record<CapitalChannelId, RawMarketChannelMetrics>;
  scores: Record<CapitalChannelId, number>;
  normalized: Record<CapitalChannelId, { revenue: number; retention: number; dwell: number }>;
  before: Record<CapitalChannelId, number>;
  after: Record<CapitalChannelId, number>;
  reason: string;
  guardsRolledBack: boolean;
  bestChannel: CapitalChannelId | null;
  weakestChannel: CapitalChannelId | null;
  totalSessions: number;
};

export type CapitalAllocationRunResult = {
  rid: string;
  markets: CapitalMarketResult[];
  allocationChanges: Array<{
    market: string;
    before: Record<string, number>;
    after: Record<string, number>;
    reason: string;
  }>;
  bestChannelsPerMarket: Record<string, string | null>;
  nextExperimentFocus: string[];
  globalTransferSuggestions: ReturnType<typeof buildGlobalTransferSuggestions>;
  experimentWinner: {
    variantId: string | null;
    label: string | null;
    experimentId: string | null;
    exploreRecommended: boolean;
  };
};

function bestAndWeakest(scores: Record<CapitalChannelId, number>): {
  best: CapitalChannelId | null;
  weakest: CapitalChannelId | null;
} {
  const ranked = [...CAPITAL_CHANNELS].sort((a, b) => {
    const d = scores[b]! - scores[a]!;
    if (d !== 0) return d;
    return a.localeCompare(b);
  });
  return { best: ranked[0] ?? null, weakest: ranked[ranked.length - 1] ?? null };
}

/**
 * One bounded allocation pass per configured market: score → bounded weights → guards → audit log.
 * Persists to `ai_activity_log` (`allocation_update`); no DB schema changes.
 */
export async function runCapitalAllocation(rid: string): Promise<CapitalAllocationRunResult> {
  const markets = listConfiguredMarkets();
  const data = await collectRevenueData();
  const agg = aggregateMarketChannelMetrics({ posts: data.posts, orders: data.orders });

  const admin = hasSupabaseAdminConfig() ? supabaseAdmin() : null;
  const lastMap = admin ? await loadLastAllocationSnapshots(admin) : new Map();

  const scoresByMarket: Record<string, Record<CapitalChannelId, number>> = {};
  const results: CapitalMarketResult[] = [];
  const allocationChanges: CapitalAllocationRunResult["allocationChanges"] = [];
  const bestChannelsPerMarket: Record<string, string | null> = {};

  for (const m of markets) {
    const raw = agg[m]!;
    const snap = marketSnapshotFromRaw(raw);
    const { normalized, scores } = normalizeAndScorePerMarket(raw);
    scoresByMarket[m] = scores;

    const totalSessions = CAPITAL_CHANNELS.reduce((s, c) => s + raw[c]!.sessions, 0);
    const band = explorationBandFromMarketSessions(totalSessions);
    const stepScale = stepScaleForBand(band);

    const prev = lastMap.get(m);
    const before = prev?.after ?? uniformWeights();

    const rolled = shouldRollback(snap, prev?.metricsSnapshot ?? null);
    let after = before;
    let reason = "bounded_reallocate";
    if (rolled) {
      after = before;
      reason = "rollback_guard";
    } else {
      const step = boundedOneStep({ before, scores, stepScale });
      after = step.after;
      reason = step.delta <= 1e-9 ? "no_feasible_step" : "bounded_reallocate";
    }

    const { best, weakest } = bestAndWeakest(scores);
    bestChannelsPerMarket[m] = best;

    const row: CapitalMarketResult = {
      market: m,
      explorationBand: band,
      channelMetrics: raw,
      scores,
      normalized,
      before,
      after,
      reason,
      guardsRolledBack: rolled,
      bestChannel: best,
      weakestChannel: weakest,
      totalSessions,
    };
    results.push(row);

    allocationChanges.push({
      market: m,
      before: { ...before },
      after: { ...after },
      reason,
    });

    await logAllocationUpdate({
      action: ALLOCATION_ACTION,
      market: m,
      before: { ...before },
      after: { ...after },
      reason,
      metricsSnapshot: { revenue: snap.revenue, retention: snap.retention, dwell: snap.dwell },
      guardsRolledBack: rolled,
      rid,
    });

    opsLog("capital_allocation.market", {
      rid,
      market: m,
      reason,
      rolledBack: rolled,
      explorationBand: band,
      stepScale,
    });
  }

  const nextExperimentFocus = markets.map((m) => {
    const sc = scoresByMarket[m]!;
    const ranked = [...CAPITAL_CHANNELS].sort((a, b) => sc[a]! - sc[b]!);
    const w = ranked[0]!;
    return `${m}: styrk måling på «${w}» (lavest score — utforsk mer trafikk der)`;
  });

  const globalTransferSuggestions = buildGlobalTransferSuggestions({ markets, scoresByMarket });

  let experimentWinner: CapitalAllocationRunResult["experimentWinner"] = {
    variantId: null,
    label: null,
    experimentId: null,
    exploreRecommended: true,
  };

  if (admin) {
    const loaded = await loadActiveExperimentVariants(admin, ROUTE);
    if (loaded) {
      const rows = await buildVariantScoreRows(admin, loaded.variants);
      const w = pickWinner(rows);
      const lowData = rows.length === 0 || rows.every((r) => r.funnel.clicks === 0 && r.funnel.revenue === 0);
      experimentWinner = {
        variantId: w?.variantId ?? null,
        label: w?.label ?? null,
        experimentId: loaded.experimentId,
        exploreRecommended: lowData || w == null,
      };
    }
  }

  opsLog("capital_allocation.done", { rid, markets: markets.length });

  return {
    rid,
    markets: results,
    allocationChanges,
    bestChannelsPerMarket,
    nextExperimentFocus,
    globalTransferSuggestions,
    experimentWinner,
  };
}
