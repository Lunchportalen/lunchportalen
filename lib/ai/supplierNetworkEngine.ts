/**
 * Multi-leverandør — sammenligning, simulering og reservevalg (kun simulert, ingen ordre).
 * Bygger på supplierPlanner-katalogen; additive utvidelser av supplierConnector-kontrakten.
 */

import type { SimulatedQuote } from "@/lib/ai/supplierConnector";
import { rankSuppliersForIngredient } from "@/lib/ai/supplierPlanner";

export function compareSuppliersLive(ingredientLabel: string): SimulatedQuote[] {
  const ranked = rankSuppliersForIngredient(ingredientLabel);
  return ranked.map((s) => ({
    supplierId: s.supplierId,
    supplierName: s.supplierName,
    ingredientKey: ingredientLabel,
    unit: "kg",
    unitPriceNok: s.unitPriceNok,
    available: s.availability !== "low",
    leadTimeDays: s.leadTimeDays,
    simulated: true,
  }));
}

/** Nest beste tilgjengelige dersom primær feiler (pris, deretter ledetid). */
export function pickFallbackSupplier(quotes: SimulatedQuote[]): SimulatedQuote | null {
  const pool = quotes.filter((q) => q.simulated);
  if (pool.length === 0) return null;
  const available = pool.filter((q) => q.available);
  const use = available.length ? available : pool;
  const sorted = [...use].sort((a, b) => {
    const pa = a.unitPriceNok ?? 9999;
    const pb = b.unitPriceNok ?? 9999;
    if (pa !== pb) return pa - pb;
    return a.leadTimeDays - b.leadTimeDays;
  });
  return sorted[0] ?? null;
}

export function simulateOrderLine(ingredientKey: string, kg: number): {
  quotes: SimulatedQuote[];
  recommended: SimulatedQuote | null;
  fallback: SimulatedQuote | null;
  note: string;
} {
  const quotes = compareSuppliersLive(ingredientKey);
  const recommended = pickFallbackSupplier(quotes);
  const rest = quotes.filter((q) => q.supplierId !== recommended?.supplierId);
  const fallback = pickFallbackSupplier(rest);
  const k = Math.max(0, kg);
  return {
    quotes,
    recommended,
    fallback,
    note: `Simulert ordrelinje ${k} kg — ingen EDI/bestilling sendt. Primær: ${recommended?.supplierName ?? "—"}, reserve: ${fallback?.supplierName ?? "—"}.`,
  };
}
