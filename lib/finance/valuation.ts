export type ValuationResult = {
  multiple: number;
  valuation: number;
  explain: string[];
};

/**
 * Multiples-modell (transparent): vekst → multiple, verdi = ARR × multiple.
 * Grenser er eksplisitte (ikke ML).
 */
export function computeValuation(input: { arr: number; growthRate: number }): ValuationResult {
  const arr = Math.max(0, Number.isFinite(input.arr) ? input.arr : 0);
  const g = Number.isFinite(input.growthRate) ? input.growthRate : 0;

  let multiple = 2;
  const explain: string[] = ["Basis-multiple 2× når vekst ≤ 20% (heuristikk, ikke markedspris)."];

  if (g > 0.5) {
    multiple = 4;
    explain.push("Vekst > 50% → multiple 4×.");
  } else if (g > 0.2) {
    multiple = 3;
    explain.push("Vekst > 20% → multiple 3×.");
  } else {
    explain.push("Vekst ≤ 20% → multiple 2×.");
  }

  if (arr <= 0) {
    return {
      multiple,
      valuation: 0,
      explain: [...explain, "ARR er 0 — verdi satt til 0 (fail-closed)."],
    };
  }

  return {
    multiple,
    valuation: arr * multiple,
    explain: [...explain, `Verdi = ARR (${arr.toFixed(2)}) × ${multiple}.`],
  };
}
