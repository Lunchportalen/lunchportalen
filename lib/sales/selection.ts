import "server-only";

import type { EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";

/**
 * Velger maks 10 aktive leads, sortert etter modell-score (winProbability).
 * Deterministisk — ingen LLM.
 */
export function selectLeadsForOutreach(rows: EnrichedPipelineDeal[]): EnrichedPipelineDeal[] {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .filter((r) => r.stage !== "won" && r.stage !== "lost")
    .sort((a, b) => {
      const aScore = a.prediction?.winProbability ?? 0;
      const bScore = b.prediction?.winProbability ?? 0;
      return bScore - aScore;
    })
    .slice(0, 10);
}
