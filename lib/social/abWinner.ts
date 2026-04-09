import type { AbVariantStats } from "@/lib/social/abAnalytics";

/**
 * Høyeste score vinner; ved lik score: lavest id (deterministisk).
 */
export function pickWinner(variants: AbVariantStats[]): AbVariantStats | null {
  if (!variants.length) return null;
  return [...variants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  })[0];
}
