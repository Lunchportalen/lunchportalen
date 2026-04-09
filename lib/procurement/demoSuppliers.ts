/**
 * Demo-leverandører per superadmin-produkt — deterministisk, ingen nettverk.
 */

import type { Supplier } from "@/lib/procurement/suppliers";

export const DEMO_SUPPLIERS_BY_PRODUCT_ID: Record<string, Supplier[]> = {
  "lp-b2b-core": [
    {
      id: "sup_nordic_catering",
      name: "Nordic Catering AS",
      pricePerUnit: 42,
      deliveryDays: 2,
      reliabilityScore: 0.92,
      minOrderQty: 8,
    },
    {
      id: "sup_freshlink",
      name: "FreshLink Distribusjon",
      pricePerUnit: 38,
      deliveryDays: 4,
      reliabilityScore: 0.78,
      minOrderQty: 12,
    },
    {
      id: "sup_budget_line",
      name: "Budget Line (import)",
      pricePerUnit: 31,
      deliveryDays: 7,
      reliabilityScore: 0.62,
      minOrderQty: 24,
    },
  ],
  "lp-b2b-roi": [
    {
      id: "sup_oslo_kjokken",
      name: "Oslo Bedriftskjøkken",
      pricePerUnit: 36,
      deliveryDays: 3,
      reliabilityScore: 0.88,
      minOrderQty: 6,
    },
    {
      id: "sup_trondelag_mat",
      name: "Trøndelag Matpartner",
      pricePerUnit: 33,
      deliveryDays: 5,
      reliabilityScore: 0.81,
    },
  ],
};

export function demoSuppliersForProduct(productId: string): Supplier[] {
  const id = String(productId ?? "").trim();
  const list = DEMO_SUPPLIERS_BY_PRODUCT_ID[id];
  return Array.isArray(list) ? [...list] : [];
}
