import type { SocialDbAnalyticsRow } from "@/lib/social/analyticsAggregate";

export type GrowthPatternSummary = {
  totalWinners: number;
  avgScore: number;
  /** Mest vanlig status blant vinnere, eller none/unknown. */
  commonType: string;
};

/**
 * Enkle, deterministiske mønstre fra aggregerte rader (samme data → samme svar).
 */
export function extractPatterns(posts: SocialDbAnalyticsRow[]): GrowthPatternSummary {
  const winners = posts.filter((p) => p.score > 10);
  const n = winners.length;
  const avgScore = n === 0 ? 0 : winners.reduce((sum, p) => sum + p.score, 0) / n;

  let commonType = "unknown";
  if (n === 0) {
    commonType = "none";
  } else {
    const counts = new Map<string, number>();
    for (const w of winners) {
      const s = (w.status || "unknown").trim() || "unknown";
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    commonType = sorted[0]?.[0] ?? "unknown";
  }

  return {
    totalWinners: n,
    avgScore,
    commonType,
  };
}
