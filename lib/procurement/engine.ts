import { pickBestSupplier, rankSuppliers } from "@/lib/procurement/scoring";
import { calculateOrderQty } from "@/lib/procurement/quantity";
import type { Supplier } from "@/lib/procurement/suppliers";

export type ProcurementProductInput = {
  id: string;
  stock: number;
};

export type ProcurementDemandInput = {
  forecastPerDay: number;
  horizonDays: number;
};

export type ProcurementSuggestion = {
  productId: string;
  supplierId: string;
  supplierName: string;
  pricePerUnit: number;
  suggestedQty: number;
  estimatedCost: number;
  deliveryDays: number;
  supplierScore: number;
  ranking: { id: string; name: string; score: number; pricePerUnit: number; deliveryDays: number }[];
};

export function suggestProcurement(
  product: ProcurementProductInput,
  suppliers: Supplier[],
  demand: ProcurementDemandInput,
): ProcurementSuggestion | null {
  const list = Array.isArray(suppliers) ? suppliers : [];
  if (list.length === 0) return null;

  const supplier = pickBestSupplier(list);
  if (!supplier) return null;

  let qty = calculateOrderQty(demand.forecastPerDay, demand.horizonDays, product.stock);
  const minQ = supplier.minOrderQty;
  if (typeof minQ === "number" && Number.isFinite(minQ) && minQ > 0 && qty > 0 && qty < minQ) {
    qty = Math.ceil(minQ);
  }

  const estimatedCost = qty * supplier.pricePerUnit;
  const ranking = rankSuppliers(list).map((s) => ({
    id: s.id,
    name: s.name,
    score: Math.round(s.score * 1000) / 1000,
    pricePerUnit: s.pricePerUnit,
    deliveryDays: s.deliveryDays,
  }));

  return {
    productId: product.id,
    supplierId: supplier.id,
    supplierName: supplier.name,
    pricePerUnit: supplier.pricePerUnit,
    suggestedQty: qty,
    estimatedCost,
    deliveryDays: supplier.deliveryDays,
    supplierScore: Math.round(supplier.score * 1000) / 1000,
    ranking,
  };
}
