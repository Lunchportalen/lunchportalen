import type { MvoComboMetrics } from "./types";

export type RoutingUser = {
  id?: string | null;
};

/**
 * Velger beste variant-nøkkel ut fra omsetning (ingen bruker-overriding — `user` reservert for senere personalisering).
 */
export function pickBestVariant(
  _user: RoutingUser,
  performanceMap: Record<string, MvoComboMetrics>
): string | null {
  const candidates = Object.entries(performanceMap);
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort(
    (a, b) => b[1].revenue - a[1].revenue || a[0].localeCompare(b[0])
  );
  return sorted[0]?.[0] ?? null;
}
