import "server-only";

import type { SwarmResultRow } from "@/lib/ai/swarm";

/**
 * Enkel flertallsavstemming på `result.action` (deterministisk ved uavgjort: leksikografisk).
 */
export function vote(results: SwarmResultRow[]): string | null {
  const scores: Record<string, number> = {};

  for (const r of results) {
    const res = r.result;
    const action =
      typeof res === "object" && res !== null && "action" in res && typeof (res as { action?: unknown }).action === "string"
        ? String((res as { action: string }).action).trim()
        : "";
    if (!action) continue;
    scores[action] = (scores[action] ?? 0) + 1;
  }

  const entries = Object.entries(scores);
  if (!entries.length) return null;

  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  return entries[0][0];
}
