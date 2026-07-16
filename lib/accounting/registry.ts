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

export type AccountingCapability = {
  adapter: string;
  /** true KUN når en faktisk native integrasjon finnes (Tripletex/Norge). */
  native: boolean;
  /** Ærlig, brukervendt beskrivelse — aldri en falsk integrasjonspåstand. */
  label: string;
};

/**
 * FASE 10 (krav 19): ærlig kapabilitetsbeskrivelse per marked.
 * Kun Norge har native regnskapsintegrasjon (Tripletex). Alle andre markeder
 * får generisk eksport — og skal ALDRI omtales som "integrert".
 */
export function describeAccountingCapability(countryCode: string): AccountingCapability {
  if (tripletexAdapter.supportsCountry(countryCode)) {
    return { adapter: "tripletex", native: true, label: "Tripletex (norsk regnskapsintegrasjon)" };
  }
  return { adapter: "csv", native: false, label: "Generisk regnskapseksport (CSV) — ingen native integrasjon" };
}
