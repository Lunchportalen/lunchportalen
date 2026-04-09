/**
 * Enkle, forklarbare rater for CEO / dashboard (ingen skjult modell).
 */

export type ObjectionInsightInput = {
  total?: number;
  hasCanteen?: number;
  cateringConverted?: number;
};

export type ObjectionInsightRates = {
  /** hasCanteen / total */
  canteenRate: number;
  /** cateringConverted / hasCanteen (0 hvis ingen kantine-treff) */
  cateringConversion: number;
};

export function calculateObjectionInsights(data: ObjectionInsightInput): ObjectionInsightRates {
  const total = Math.max(1, data.total ?? 1);
  const hasCanteen = Math.max(0, data.hasCanteen ?? 0);
  const cateringConverted = Math.max(0, data.cateringConverted ?? 0);

  return {
    canteenRate: hasCanteen / total,
    cateringConversion: hasCanteen > 0 ? cateringConverted / hasCanteen : 0,
  };
}
