export type DealScoreInput = {
  value: number;
  stage: string;
  recent_activity: boolean;
  age_days: number;
};

/**
 * Enkel, deterministisk score (0–100) — ingen eksterne kall.
 */
export function scoreDeal(deal: DealScoreInput): number {
  let score = 0;

  if (deal.value > 50000) score += 20;
  if (deal.stage === "proposal") score += 20;
  if (deal.stage === "negotiation") score += 30;
  if (deal.recent_activity) score += 20;
  if (deal.age_days < 14) score += 10;

  return Math.min(score, 100);
}

export function scoreBand(score: number): "green" | "yellow" | "red" {
  if (score > 70) return "green";
  if (score >= 40) return "yellow";
  return "red";
}
