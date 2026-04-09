/**
 * Etterspørsel (porsjoner per meny) → innkjøpsbehov i kg med sikkerhetsbuffer.
 * Kjerne: deterministisk — ingen nettverkskall.
 */

import { recipeForMenuKey } from "@/lib/ai/menuToIngredients";

/** Kontraktsfelt — stabilt for integrasjoner. */
export type ProcurementLine = {
  ingredient: string;
  /** Netto mengde uten buffer (kg). */
  requiredAmount: number;
  /** Tillegg fra sikkerhetsbuffer (kg). */
  safetyBuffer: number;
  unit: "kg";
  /** requiredAmount + safetyBuffer */
  totalWithBuffer: number;
};

export type ProcurementPlanInput = {
  /** Antall porsjoner per rå meny-nøkkel (choice_key). */
  portionsByMenu: Record<string, number>;
  /** Buffer i prosent (f.eks. fra etterspørselsprognose). */
  bufferPercent: number;
};

function roundKg(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Summerer ingredienser på tvers av menyer og legger på buffer per linje.
 */
export function buildProcurementPlan(input: ProcurementPlanInput): {
  lines: ProcurementLine[];
  transparency: string[];
} {
  const transparency: string[] = [
    "Basert på prognostiserte porsjoner per menyvalg og statisk oppskriftskatalog (menuToIngredients).",
    "Juster tall mot faktiske oppskrifter og leverandørens enheter før bestilling.",
  ];

  const grams = new Map<string, string>(); // key -> label
  const sumGrams = new Map<string, number>();

  for (const [rawMenu, portions] of Object.entries(input.portionsByMenu)) {
    const n = Math.max(0, Math.floor(Number(portions) || 0));
    if (n <= 0) continue;
    const recipe = recipeForMenuKey(rawMenu);
    for (const ing of recipe.ingredients) {
      grams.set(ing.key, ing.label);
      sumGrams.set(ing.key, (sumGrams.get(ing.key) ?? 0) + ing.gramsPerPortion * n);
    }
  }

  const bp = Math.max(0, Math.min(50, Number(input.bufferPercent) || 0));
  const factor = bp / 100;

  const lines: ProcurementLine[] = [...sumGrams.entries()]
    .map(([key, g]) => {
      const baseKg = g / 1000;
      const bufKg = baseKg * factor;
      return {
        ingredient: grams.get(key) ?? key,
        requiredAmount: roundKg(baseKg),
        safetyBuffer: roundKg(bufKg),
        unit: "kg" as const,
        totalWithBuffer: roundKg(baseKg + bufKg),
      };
    })
    .filter((l) => l.totalWithBuffer > 0)
    .sort((a, b) => a.ingredient.localeCompare(b.ingredient, "nb"));

  if (lines.length === 0) {
    transparency.push("Ingen porsjoner å planlegge — tom innkjøpsplan.");
  }

  return { lines, transparency };
}
