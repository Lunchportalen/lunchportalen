/**
 * V1: regelbasert leverandørforslag (pris, leveringstid, tilgjengelighet).
 * Kun rangering og forklaring — ingen automatikk.
 */

export type SupplierScore = {
  supplierId: string;
  supplierName: string;
  score: number;
  unitPriceNok: number | null;
  leadTimeDays: number;
  availability: "high" | "medium" | "low";
  reasons: string[];
};

type SupplierCatalogEntry = {
  id: string;
  name: string;
  leadTimeDays: number;
  availability: SupplierScore["availability"];
  /** Pris pr kg for ingrediensnøkkel (forenklet V1). */
  pricesPerKg: Record<string, number>;
};

const SUPPLIERS: SupplierCatalogEntry[] = [
  {
    id: "nordic_fresh",
    name: "Nordic Fresh AS",
    leadTimeDays: 1,
    availability: "high",
    pricesPerKg: {
      kyllingfilet: 89,
      kjottdeig: 95,
      fisk: 120,
      gronnsaker: 28,
      ris: 22,
      ost: 110,
      tomat: 35,
    },
  },
  {
    id: "city_gross",
    name: "City Gross Partner",
    leadTimeDays: 2,
    availability: "high",
    pricesPerKg: {
      kyllingfilet: 92,
      kjottdeig: 88,
      fisk: 115,
      gronnsaker: 24,
      ris: 21,
      ost: 108,
      tomat: 32,
    },
  },
  {
    id: "budget_line",
    name: "Budget Line",
    leadTimeDays: 3,
    availability: "medium",
    pricesPerKg: {
      kyllingfilet: 82,
      kjottdeig: 79,
      fisk: 128,
      gronnsaker: 20,
      ris: 19,
      ost: 99,
      tomat: 29,
    },
  },
];

/** Mapper visningsnavn til prisnøkkel (best effort). */
function priceKeyFromIngredientLabel(label: string): string {
  const s = label.toLowerCase();
  if (s.includes("kylling")) return "kyllingfilet";
  if (s.includes("kjøtt") || s.includes("kjott")) return "kjottdeig";
  if (s.includes("fisk")) return "fisk";
  if (s.includes("grønn") || s.includes("gronn")) return "gronnsaker";
  if (s.includes("ris")) return "ris";
  if (s.includes("ost")) return "ost";
  if (s.includes("tomat")) return "tomat";
  return "gronnsaker";
}

/**
 * Lavere score er bedre (pris-dominerende, straff for lang ledetid og lav tilgjengelighet).
 */
export function rankSuppliersForIngredient(ingredientLabel: string): SupplierScore[] {
  const pk = priceKeyFromIngredientLabel(ingredientLabel);

  const scored = SUPPLIERS.map((s) => {
    const price = s.pricesPerKg[pk] ?? s.pricesPerKg.gronnsaker ?? null;
    const availW = s.availability === "high" ? 0 : s.availability === "medium" ? 3 : 8;
    const score = (price ?? 200) + s.leadTimeDays * 2 + availW;
    const reasons: string[] = [];
    if (price != null) reasons.push(`Enhetspris indikativ: ca. ${price} kr/kg for «${pk}».`);
    reasons.push(`Leveringstid: ${s.leadTimeDays} virkedag(er).`);
    reasons.push(`Tilgjengelighet: ${s.availability}.`);
    return {
      supplierId: s.id,
      supplierName: s.name,
      score,
      unitPriceNok: price,
      leadTimeDays: s.leadTimeDays,
      availability: s.availability,
      reasons,
    };
  });

  return scored.sort((a, b) => a.score - b.score);
}

export function suggestSupplierLines(ingredientLabels: string[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const label of ingredientLabels.slice(0, 6)) {
    const top = rankSuppliersForIngredient(label)[0];
    if (!top || seen.has(label)) continue;
    seen.add(label);
    lines.push(
      `For «${label}»: foreslått leverandør ${top.supplierName} (regel: lav pris + kort ledetid + tilgjengelighet).`,
    );
  }
  if (lines.length === 0) lines.push("Ingen leverandørforslag — mangler ingrediensliste.");
  return lines;
}
