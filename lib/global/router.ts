import { transferLearning } from "./transfer";
import type { LearningGraph } from "./graph";

export type GlobalUser = {
  id?: string | null;
  market?: string | null;
};

/**
 * Preferer lokalt bestående combo for markedet; ellers forslag fra transfer (krever lokal test før bruk).
 * `localBestByMarket`: map fra `market_id` → beste combo-nøkkel fra lokale ordre/MVO.
 */
export function routeGlobal(
  user: GlobalUser,
  localBestByMarket: Record<string, string | null | undefined>,
  globalGraph: LearningGraph
): string | null {
  const m = typeof user.market === "string" ? user.market.trim() : "";
  if (!m) return null;

  const local = localBestByMarket[m];
  if (typeof local === "string" && local.trim()) {
    return local.trim();
  }

  const candidates = transferLearning(globalGraph, m, { maxResults: 1, minRevenue: 10_000 });
  return candidates[0]?.combo ?? null;
}
