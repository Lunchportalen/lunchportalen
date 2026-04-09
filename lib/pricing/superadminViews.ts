/**
 * Rader til superadmin kontrolltårn (pris + leverandørforhandling).
 */

import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import type { CalendarPost } from "@/lib/social/calendar";
import { aggregateProductSignals, demandScoreFromSignals } from "@/lib/social/aggregateProductSignals";
import { pickBestSupplier } from "@/lib/procurement/scoring";
import type { Supplier } from "@/lib/procurement/suppliers";
import { suggestSupplierNegotiation } from "@/lib/procurement/negotiation";
import { socialRefToProductEconomics } from "@/lib/product/socialRefEconomics";
import { suggestRetailPriceWithGuards } from "@/lib/pricing/safeRetail";

export function peerMedianUnitPrice(suppliers: Supplier[], excludeSupplierId: string): number {
  const prices = suppliers
    .filter((s) => s.id !== excludeSupplierId)
    .map((s) => s.pricePerUnit)
    .filter((p) => typeof p === "number" && Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return 0;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 === 1 ? prices[mid]! : (prices[mid - 1]! + prices[mid]!) / 2;
}

export type PriceOptimizationRow = {
  productId: string;
  productName: string;
  currentPrice: number;
  suggestedPrice: number;
  rawSuggested: number;
  marginBeforePct: number;
  marginAfterPct: number;
  demandScore: number;
  demandLabel: "Høy" | "Middels" | "Lav";
  elasticityNb: string;
  elasticity: string;
  procurementUnitCost: number | null;
  notes: string[];
  guardPassed: boolean;
};

export type SupplierNegotiationRow = {
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  supplierPricePerUnit: number;
  marketReference: number;
  negotiation: ReturnType<typeof suggestSupplierNegotiation>;
};

function demandLabel(score: number): "Høy" | "Middels" | "Lav" {
  if (score > 0.7) return "Høy";
  if (score < 0.3) return "Lav";
  return "Middels";
}

function elasticityNb(e: string): string {
  if (e === "low") return "Lav prisfølsomhet (sterk etterspørsel)";
  if (e === "high") return "Høy prisfølsomhet";
  return "Moderat";
}

export function buildPriceOptimizationRows(
  catalog: SocialProductRef[],
  posts: CalendarPost[],
  getSuppliers: (productId: string) => Supplier[],
): PriceOptimizationRow[] {
  const agg = aggregateProductSignals(posts);
  const list = Array.isArray(catalog) ? catalog : [];
  const rows: PriceOptimizationRow[] = [];

  for (const ref of list) {
    const econ = socialRefToProductEconomics(ref);
    if (!econ) continue;
    const demandScore = demandScoreFromSignals(agg.get(ref.id)) ?? 0.45;
    const suppliers = getSuppliers(ref.id);
    const best = pickBestSupplier(suppliers);
    const procurementUnitCost = best ? best.pricePerUnit : null;

    const safe = suggestRetailPriceWithGuards({
      price: econ.price,
      cost: econ.cost,
      demandScore,
      procurementUnitCost: procurementUnitCost ?? undefined,
    });

    rows.push({
      productId: ref.id,
      productName: String(ref.name ?? "").trim() || ref.id,
      currentPrice: safe.currentPrice,
      suggestedPrice: safe.suggestedPrice,
      rawSuggested: safe.rawSuggested,
      marginBeforePct: safe.marginBefore * 100,
      marginAfterPct: safe.marginAfter * 100,
      demandScore: Math.round(demandScore * 1000) / 1000,
      demandLabel: demandLabel(demandScore),
      elasticityNb: elasticityNb(safe.elasticity),
      elasticity: safe.elasticity,
      procurementUnitCost,
      notes: safe.notes,
      guardPassed: safe.guardPassed,
    });
  }

  return rows.sort((a, b) => a.productName.localeCompare(b.productName, "nb"));
}

export function buildSupplierNegotiationRows(
  catalog: SocialProductRef[],
  getSuppliers: (productId: string) => Supplier[],
): SupplierNegotiationRow[] {
  const list = Array.isArray(catalog) ? catalog : [];
  const rows: SupplierNegotiationRow[] = [];

  for (const ref of list) {
    const suppliers = getSuppliers(ref.id);
    if (suppliers.length === 0) continue;
    const name = String(ref.name ?? "").trim() || ref.id;
    for (const s of suppliers) {
      const marketRef = peerMedianUnitPrice(suppliers, s.id);
      const negotiation = suggestSupplierNegotiation(s, marketRef);
      rows.push({
        productId: ref.id,
        productName: name,
        supplierId: s.id,
        supplierName: s.name,
        supplierPricePerUnit: s.pricePerUnit,
        marketReference: marketRef,
        negotiation,
      });
    }
  }

  return rows.sort((a, b) => {
    const p = a.productId.localeCompare(b.productId);
    if (p !== 0) return p;
    return a.supplierName.localeCompare(b.supplierName, "nb");
  });
}
