/**
 * Enkel etterspørselsproxy — ingen estimering av elastisitetskoeffisient, kun tre nivåer.
 */

export type ElasticityEstimate = "low" | "medium" | "high";

export type ElasticityProductInput = {
  demandScore?: number;
};

export function estimateElasticity(product: ElasticityProductInput): ElasticityEstimate {
  const d =
    typeof product.demandScore === "number" && Number.isFinite(product.demandScore) ? product.demandScore : 0.5;
  const clamped = Math.min(1, Math.max(0, d));
  if (clamped > 0.7) return "low";
  if (clamped < 0.3) return "high";
  return "medium";
}
