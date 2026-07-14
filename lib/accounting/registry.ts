// lib/accounting/registry.ts
//
// FASE 8 — adapteroppslag per marked. Regel (LÅST):
//   - Tripletex kun for Norge (NO) og kun når integrasjonen er aktivert.
//   - Alle andre markeder → standard CSV-eksport.
//   - ALDRI Stripe, aldri Tripletex som global default.
import "server-only";

import type { AccountingAdapter } from "@/lib/accounting/adapter";
import { tripletexAdapter } from "@/lib/accounting/tripletexAdapter";
import { csvAdapter } from "@/lib/accounting/csvAdapter";

export function resolveAccountingAdapter(countryCode: string): AccountingAdapter {
  if (tripletexAdapter.supportsCountry(countryCode)) return tripletexAdapter;
  return csvAdapter;
}
