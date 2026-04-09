/**
 * Kost / margin / svinn — forenklede nøkkeltall for kontrolltårn (ingen regnskapssystem-erstatning).
 */

export type ProfitSnapshot = {
  costPerMealNok: number | null;
  marginPerCompanyNok: number | null;
  wasteCostNok: number | null;
  transparency: string[];
};

/**
 * ingredientCostEstimateNok: sum estimat for ukentlig innkjøp / 5 / porsjoner (forenklet).
 */
export function computeRealtimeProfitability(opts: {
  pricePerMealExVat: number | null;
  ingredientCostEstimateNok: number | null;
  /** Prognosefeil i porsjoner (abs). */
  forecastErrorPortions: number | null;
  /** NOK per feil-porsjon (straff for svinn/overproduksjon). */
  wasteUnitCostNok: number;
}): ProfitSnapshot {
  const transparency = [
    "Margin er beregnet som pris (ex. mva) minus forenklet ingrediens-/produksjonskost per måltid.",
    "Svinnkost er proporsjonal med hindcast/prognosefeil — juster wasteUnitCostNok etter faktisk operasjonell modell.",
  ];

  const price = opts.pricePerMealExVat;
  const cost = opts.ingredientCostEstimateNok;
  let costPerMealNok: number | null = null;
  let marginPerCompanyNok: number | null = null;

  if (price != null && Number.isFinite(price) && cost != null && Number.isFinite(cost)) {
    costPerMealNok = Math.round(cost * 100) / 100;
    marginPerCompanyNok = Math.round((price - cost) * 100) / 100;
  }

  const err = opts.forecastErrorPortions != null && Number.isFinite(opts.forecastErrorPortions) ? Math.abs(opts.forecastErrorPortions) : 0;
  const wasteCostNok = Math.round(err * opts.wasteUnitCostNok * 100) / 100;

  return {
    costPerMealNok,
    marginPerCompanyNok,
    wasteCostNok: err > 0 ? wasteCostNok : null,
    transparency,
  };
}
