import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import type { SupabaseClient } from "@supabase/supabase-js";

import { opsLog } from "@/lib/ops/log";

import {
  bestCombosPerMarket,
  buildLearningGraph,
  parseGraphKey,
  sumGraphRevenue,
  type ActivityLogLike,
} from "./graph";
import { storeLearning } from "./learningStore";
import { transferLearning } from "./transfer";

const ROUTE = "global_learning_cycle";

const MAX_TRANSFERS_PER_RUN = 1;
const ROLLBACK_RATIO = 0.9;

async function loadPreviousGraphTotal(admin: SupabaseClient): Promise<number | null> {
  const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
  if (!ok) return null;
  const { data, error } = await admin
    .from("ai_activity_log")
    .select("metadata")
    .eq("action", "global_learning")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || typeof data !== "object") return null;
  const m = (data as { metadata?: unknown }).metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const t = (m as Record<string, unknown>).graph_total_revenue;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  if (typeof t === "string" && t.trim()) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export type GlobalLearningCycleSummary = {
  graphNodes: number;
  graphTotalRevenue: number;
  bestPerMarket: Record<string, { combo: string; revenue: number; count: number }>;
  transfersConsidered: number;
  transferred: Array<{ combo: string; sourceMarket: string; targetMarket: string; confidence: number }>;
  rollbackSuggested: boolean;
  stored: boolean;
};

/**
 * Henter logger, bygger graf, velger maks én overføring per kjøring, logger `global_learning`.
 * Bruker ikke global læring direkte i produksjon — kun dokumentasjon + neste steg for lokal test.
 */
export async function runGlobalLearningCycle(admin: SupabaseClient, rid: string): Promise<GlobalLearningCycleSummary> {
  const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
  if (!ok) {
    return {
      graphNodes: 0,
      graphTotalRevenue: 0,
      bestPerMarket: {},
      transfersConsidered: 0,
      transferred: [],
      rollbackSuggested: false,
      stored: false,
    };
  }

  const { data: rows, error } = await admin
    .from("ai_activity_log")
    .select("action, metadata, created_at")
    .eq("action", "mvo_learning")
    .order("created_at", { ascending: false })
    .limit(4000);

  if (error || !Array.isArray(rows)) {
    opsLog("global_learning_fetch_failed", { rid, message: error?.message });
    return {
      graphNodes: 0,
      graphTotalRevenue: 0,
      bestPerMarket: {},
      transfersConsidered: 0,
      transferred: [],
      rollbackSuggested: false,
      stored: false,
    };
  }

  const graph = buildLearningGraph(rows as ActivityLogLike[]);
  const graphTotalRevenue = sumGraphRevenue(graph);
  const bestPerMarket = bestCombosPerMarket(graph);

  const markets = new Set<string>();
  for (const k of Object.keys(graph)) {
    markets.add(parseGraphKey(k).market);
  }

  const allTransfers: ReturnType<typeof transferLearning> = [];
  for (const m of markets) {
    allTransfers.push(...transferLearning(graph, m, { minRevenue: 10_000, maxResults: 50 }));
  }
  allTransfers.sort((a, b) => b.confidence - a.confidence || a.combo.localeCompare(b.combo));
  const transferred = allTransfers.slice(0, MAX_TRANSFERS_PER_RUN);

  const prev = await loadPreviousGraphTotal(admin);
  const rollbackSuggested =
    prev != null && graphTotalRevenue > 0 && graphTotalRevenue < prev * ROLLBACK_RATIO;

  const stored = await storeLearning(
    admin,
    {
      graph_total_revenue: graphTotalRevenue,
      graph_node_count: Object.keys(graph).length,
      best_per_market: bestPerMarket,
      transfer_candidates: allTransfers.length,
      transfers: transferred,
      rollback_suggested: rollbackSuggested,
      prev_graph_total_revenue: prev,
      safety: {
        max_transfers_applied: MAX_TRANSFERS_PER_RUN,
        note: "Never apply global transfer without local experiment; max 1 suggestion per cron.",
      },
    },
    rid
  );

  opsLog("global_learning_cycle", {
    rid,
    nodes: Object.keys(graph).length,
    rollbackSuggested,
    transfers: transferred.length,
  });

  return {
    graphNodes: Object.keys(graph).length,
    graphTotalRevenue,
    bestPerMarket,
    transfersConsidered: allTransfers.length,
    transferred: transferred.map((t) => ({
      combo: t.combo,
      sourceMarket: t.sourceMarket,
      targetMarket: t.targetMarket,
      confidence: t.confidence,
    })),
    rollbackSuggested,
    stored: stored.ok,
  };
}
