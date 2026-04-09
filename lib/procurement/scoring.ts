import type { Supplier } from "@/lib/procurement/suppliers";

export type ScoredSupplier = Supplier & { score: number };

export function scoreSupplier(s: Supplier): number {
  const price = typeof s.pricePerUnit === "number" && Number.isFinite(s.pricePerUnit) && s.pricePerUnit > 0 ? s.pricePerUnit : 0;
  const days = typeof s.deliveryDays === "number" && Number.isFinite(s.deliveryDays) && s.deliveryDays > 0 ? s.deliveryDays : 999;
  const rel =
    typeof s.reliabilityScore === "number" && Number.isFinite(s.reliabilityScore)
      ? Math.min(1, Math.max(0, s.reliabilityScore))
      : 0;

  let score = 0;
  score += (1 / price) * 50;
  score += (1 / days) * 20;
  score += rel * 30;
  return score;
}

export function rankSuppliers(suppliers: Supplier[]): ScoredSupplier[] {
  const list = Array.isArray(suppliers) ? suppliers : [];
  return list
    .map((s) => ({ ...s, score: scoreSupplier(s) }))
    .sort((a, b) => b.score - a.score);
}

export function pickBestSupplier(suppliers: Supplier[]): ScoredSupplier | undefined {
  const ranked = rankSuppliers(suppliers);
  return ranked[0];
}
