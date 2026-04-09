import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  bestCombosPerMarket,
  buildLearningGraph,
  parseGraphKey,
  sumGraphRevenue,
  type ActivityLogLike,
  type LearningGraph,
} from "./graph";
import { transferLearning } from "./transfer";

const ROUTE = "global_intelligence_snapshot";

export type GlobalIntelligenceSnapshot = {
  graph: LearningGraph;
  graphTotalRevenue: number;
  bestPerMarket: Record<string, { combo: string; revenue: number; count: number }>;
  /** Topp forslag (forklaring — ikke aktivert automatisk). */
  transferPreview: Array<{
    combo: string;
    sourceMarket: string;
    targetMarket: string;
    confidence: number;
  }>;
};

/**
 * Les-only: bygger graf fra `mvo_learning` uten å skrive nye rader.
 */
export async function getGlobalIntelligenceSnapshot(admin: SupabaseClient): Promise<GlobalIntelligenceSnapshot | null> {
  const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
  if (!ok) return null;

  const { data: rows, error } = await admin
    .from("ai_activity_log")
    .select("action, metadata, created_at")
    .eq("action", "mvo_learning")
    .order("created_at", { ascending: false })
    .limit(4000);

  if (error || !Array.isArray(rows)) return null;

  const graph = buildLearningGraph(rows as ActivityLogLike[]);
  const bestPerMarket = bestCombosPerMarket(graph);
  const markets = new Set<string>();
  for (const k of Object.keys(graph)) {
    markets.add(parseGraphKey(k).market);
  }

  const all: ReturnType<typeof transferLearning> = [];
  for (const m of markets) {
    all.push(...transferLearning(graph, m, { minRevenue: 10_000, maxResults: 3 }));
  }
  all.sort((a, b) => b.confidence - a.confidence || a.combo.localeCompare(b.combo));

  return {
    graph,
    graphTotalRevenue: sumGraphRevenue(graph),
    bestPerMarket,
    transferPreview: all.slice(0, 8).map((t) => ({
      combo: t.combo,
      sourceMarket: t.sourceMarket,
      targetMarket: t.targetMarket,
      confidence: t.confidence,
    })),
  };
}
