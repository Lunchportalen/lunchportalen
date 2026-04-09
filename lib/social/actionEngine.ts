import type { SocialDbAnalyticsRow } from "@/lib/social/analyticsAggregate";

export type GrowthNextAction = {
  type: "fix_content" | "scale_winner" | "increase_volume" | string;
  message: string;
};

/**
 * Prioritering av neste steg ut fra samme aggregat som analytics/recommendations.
 */
export function getNextActions(posts: SocialDbAnalyticsRow[]): GrowthNextAction[] {
  const sorted = [...posts].sort((a, b) => a.id.localeCompare(b.id));
  const actions: GrowthNextAction[] = [];

  const low = sorted.filter((p) => p.score < 3).length;
  const high = sorted.filter((p) => p.score > 10).length;

  if (low > 3) {
    actions.push({
      type: "fix_content",
      message: "For mange innlegg gir lav respons",
    });
  }

  if (high > 1) {
    actions.push({
      type: "scale_winner",
      message: "Skaler det som fungerer",
    });
  }

  if (sorted.length < 5) {
    actions.push({
      type: "increase_volume",
      message: "Du må poste mer",
    });
  }

  return actions;
}
