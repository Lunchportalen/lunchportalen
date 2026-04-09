export type ScenarioBand = {
  downside: number;
  base: number;
  upside: number;
  explain: string[];
};

/**
 * Enkle multiplikatorer på basisverdi — scenario, ikke prognose.
 */
export function computeScenarios(baseValuation: number): ScenarioBand {
  const base = Math.max(0, Number.isFinite(baseValuation) ? baseValuation : 0);
  return {
    downside: base * 0.7,
    base,
    upside: base * 1.5,
    explain: [
      "Nedsider: basis × 0,7.",
      "Oppsider: basis × 1,5.",
      "Ingen sannsynlighetsvekting — kun sensitivitetsbånd for styring.",
    ],
  };
}
