/**
 * Deterministisk, forklarbar deal-prognose (ingen ML).
 * Alle felt er valgfrie — manglende verdier behandles som 0 / «lead».
 */

export type DealPredictInput = {
  value?: unknown;
  stage?: unknown;
  probability?: unknown;
  age_days?: unknown;
};

export type PredictionResult = {
  /** 0–100, avledet fra regelbasert score (ikke sannsynlighet i 0–1-format). */
  winProbability: number;
  risk: "low" | "medium" | "high";
  reasons: string[];
};

function safeNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function safeStage(v: unknown): string {
  return typeof v === "string" && v.length > 0 ? v : "lead";
}

export function predictDeal(deal: DealPredictInput | null | undefined): PredictionResult {
  const d = deal ?? {};
  let score = 0;
  const reasons: string[] = [];

  const value = safeNum(d.value ?? 0);
  const stage = safeStage(d.stage);
  const probability = safeNum(d.probability ?? 0);
  const age = safeNum(d.age_days ?? 0);

  if (stage === "negotiation") {
    score += 30;
    reasons.push("Late stage");
  }

  if (stage === "proposal") {
    score += 20;
    reasons.push("Proposal sent");
  }

  if (probability > 0.6) {
    score += 20;
    reasons.push("High probability");
  }

  if (value > 50000) {
    score += 10;
    reasons.push("High value");
  }

  if (age > 14) {
    score -= 20;
    reasons.push("Stale deal");
  }

  if (age > 30) {
    score -= 30;
    reasons.push("Very old deal");
  }

  const winProbability = Math.max(0, Math.min(100, score));

  return {
    winProbability,
    risk: winProbability < 40 ? "high" : winProbability < 70 ? "medium" : "low",
    reasons,
  };
}
