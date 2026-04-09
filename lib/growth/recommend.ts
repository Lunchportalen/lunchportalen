import type { ExtractedPattern } from "@/lib/growth/learning";

export type Recommendation = {
  suggestion: string;
  reason: string;
};

export function recommendNextPost(patterns: ExtractedPattern[]): Recommendation | null {
  const best = patterns.filter((p) => p.success && p.hook.trim().length > 0);
  const first = best[0];
  if (!first) return null;
  return {
    suggestion: first.hook,
    reason: "Høy konvertering observert på eksisterende innhold (deterministisk topp-mønster).",
  };
}
