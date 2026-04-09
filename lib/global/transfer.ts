import { parseGraphKey, type LearningGraph } from "./graph";

export type TransferCandidate = {
  combo: string;
  sourceMarket: string;
  targetMarket: string;
  /** Forklarbar tillitsscore: bruker omsetning fra kilden (ordre = sannhet). */
  confidence: number;
};

const DEFAULT_MIN_REVENUE = 10_000;

/**
 * Forslag til krysmarked-overføring: kilder med høy omsetning, aldri samme marked som mål.
 * Sortert synkende på `confidence`. Bruk `maxResults` for sikkerhetsgrense (f.eks. 1 per cron).
 */
export function transferLearning(
  graph: LearningGraph,
  targetMarket: string,
  opts?: { minRevenue?: number; maxResults?: number }
): TransferCandidate[] {
  const target = typeof targetMarket === "string" ? targetMarket.trim() : "";
  if (!target) return [];

  const minRev = opts?.minRevenue ?? DEFAULT_MIN_REVENUE;
  const maxResults = opts?.maxResults ?? 100;

  const results: TransferCandidate[] = [];

  for (const [key, data] of Object.entries(graph)) {
    const { combo, market: sourceMarket } = parseGraphKey(key);
    if (sourceMarket === target) continue;
    if (data.revenue > minRev) {
      results.push({
        combo,
        sourceMarket,
        targetMarket: target,
        confidence: data.revenue,
      });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence || a.combo.localeCompare(b.combo));
  return results.slice(0, Math.max(0, maxResults));
}
