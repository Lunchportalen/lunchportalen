import type { SocialDbAnalyticsRow } from "@/lib/social/analyticsAggregate";

export type SocialRecommendation = {
  type: "low_performance" | "scale" | "volume" | string;
  message: string;
};

/**
 * Enkle, deterministiske anbefalinger fra aggregerte rader (samme inndata → samme utdata).
 */
export function getRecommendations(posts: SocialDbAnalyticsRow[]): SocialRecommendation[] {
  const sorted = [...posts].sort((a, b) => a.id.localeCompare(b.id));
  const lowPerformers = sorted.filter((p) => p.score < 3);
  const highPerformers = sorted.filter((p) => p.score > 10);
  const recommendations: SocialRecommendation[] = [];

  if (lowPerformers.length > 3) {
    recommendations.push({
      type: "low_performance",
      message: "Flere innlegg gir lav respons – lag nye varianter",
    });
  }

  if (highPerformers.length > 2) {
    recommendations.push({
      type: "scale",
      message: "Skaler innlegg som fungerer",
    });
  }

  if (sorted.length < 5) {
    recommendations.push({
      type: "volume",
      message: "Du poster for lite",
    });
  }

  return recommendations;
}
