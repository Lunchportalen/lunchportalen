/**
 * Leverandørforhandling — kun signaler og tekst (ingen auto-negotiation).
 */

import type { Supplier } from "@/lib/procurement/suppliers";

export type NegotiationSuggestion =
  | { action: "negotiate_down"; targetPrice: number; message: string }
  | { action: "ok"; message: string };

export function suggestSupplierNegotiation(supplier: Supplier, marketPrice: number): NegotiationSuggestion {
  const mp = typeof marketPrice === "number" && Number.isFinite(marketPrice) && marketPrice > 0 ? marketPrice : 0;
  const sp = supplier.pricePerUnit;
  if (!(typeof sp === "number" && Number.isFinite(sp) && sp > 0)) {
    return { action: "ok", message: "Ugyldig leverandørpris — ingen forhandlingsforslag." };
  }
  if (mp <= 0) {
    return { action: "ok", message: "Mangler markedsreferanse — ingen automatisk forhandlingsforslag." };
  }
  const diff = sp - mp;
  if (diff > 0) {
    return {
      action: "negotiate_down",
      targetPrice: mp,
      message: "Pris over marked – foreslå lavere pris",
    };
  }
  return {
    action: "ok",
    message: "Pris konkurransedyktig",
  };
}
