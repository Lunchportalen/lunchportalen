/**
 * Regelbasert, forklarbar score (0–100). Ingen svarte bokser.
 */
import type { PipelineStageId } from "@/lib/pipeline/stages";

export type DealFeatures = {
  age_days: number;
  days_since_last_activity: number;
  activity_count: number;
  clicks: number;
  orders_historical: number;
  views: number;
  conversions: number;
  revenue: number;
};

export type AdvancedPrediction = {
  /** 0–100 */
  probability: number;
  risk: "low" | "medium" | "high";
  reasons: string[];
};

export function predictOutcome(
  features: DealFeatures,
  stage: PipelineStageId | string,
): AdvancedPrediction {
  const reasons: string[] = [];
  let score = 45;

  // RECENCY
  if (features.days_since_last_activity < 2) {
    score += 25;
    reasons.push("Nylig aktivitet");
  } else if (features.days_since_last_activity > 7) {
    score -= 20;
    reasons.push("Ingen aktivitet på over en uke");
  }

  // ACTIVITY (touchpoints)
  if (features.activity_count > 5) {
    score += 20;
    reasons.push("Høyt aktivitetsnivå");
  } else if (features.activity_count > 0) {
    score += 8;
    reasons.push("Registrert aktivitet");
  }

  // ENGAGEMENT (SoMe / metrics)
  if (features.clicks > 10) {
    score += 12;
    reasons.push("Høy klikkaktivitet på innhold");
  } else if (features.clicks > 0) {
    score += 4;
    reasons.push("Klikk registrert");
  }

  if (features.orders_historical > 0) {
    score += 15;
    reasons.push("Ordre knyttet til SoMe-kilde");
  }

  if (features.conversions > 0) {
    score += 8;
    reasons.push("Konverteringer i SoMe-metrics");
  }

  // AGE
  if (features.age_days < 7) {
    score += 10;
    reasons.push("Ny lead");
  } else if (features.age_days > 30) {
    score -= 25;
    reasons.push("Eldre lead uten tydelig fremdrift");
  }

  // STAGE (kanban: lead, qualified, proposal, negotiation, won, lost)
  const s = String(stage);
  if (s === "proposal" || s === "negotiation") {
    score += 20;
    reasons.push("Sent i salgsløpet");
  } else if (s === "qualified") {
    score += 15;
    reasons.push("Kvalifisert");
  } else if (s === "lead") {
    score += 5;
    reasons.push("Tidlig fase");
  }

  const probability = Math.max(0, Math.min(100, Math.round(score)));

  const risk: AdvancedPrediction["risk"] =
    probability < 40 ? "high" : probability < 70 ? "medium" : "low";

  if (reasons.length === 0) {
    reasons.push("Standard signaler (begrenset aktivitet)");
  }

  return { probability, risk, reasons };
}
