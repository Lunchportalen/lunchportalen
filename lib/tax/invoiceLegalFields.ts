/**
 * FASE 10 — lovpålagte fakturafelter og skatteetiketter per marked (edge-safe).
 *
 * Skattebeslutninger tas ALDRI fra språk/locale — kun fra markedets country.
 * Locale styrer bare presentasjon (tall-/datoformat via Intl).
 */

import { getMarketCountry, type CountryCode } from "@/lib/markets/supportedMarkets";

/** Felles lovpålagte felter for alle markeder (speiler markets.invoice_legal_fields-basen). */
export const BASE_INVOICE_LEGAL_FIELDS = [
  "invoice_number",
  "issue_date",
  "due_date",
  "seller_legal_name",
  "seller_address",
  "seller_tax_id",
  "buyer_legal_name",
  "buyer_address",
  "line_descriptions",
  "net_amount",
  "tax_rate",
  "tax_amount",
  "gross_amount",
  "currency",
  "payment_terms",
] as const;

/** Markedsspesifikke tillegg (nøkler matcher markets.invoice_legal_fields-seeden). */
export const EXTRA_INVOICE_LEGAL_FIELDS: Partial<Record<CountryCode, readonly string[]>> = {
  NO: ["organisasjonsnummer_mva_suffix"],
  GB: ["uk_vat_registration_number"],
  CH: ["ch_uid_mwst_number"],
  US: ["state_province", "sales_tax_rate_by_jurisdiction"],
  CA: ["state_province", "gst_hst_registration_number"],
};

export function requiredInvoiceLegalFields(countryCode: string): readonly string[] {
  const country = String(countryCode ?? "").trim().toUpperCase() as CountryCode;
  const extra = EXTRA_INVOICE_LEGAL_FIELDS[country] ?? [];
  return [...BASE_INVOICE_LEGAL_FIELDS, ...extra];
}

/** Skatteetikett per strategi — bestemmes av markedet, aldri av språket. */
export function taxLabelForCountry(countryCode: string): string {
  const market = getMarketCountry(countryCode);
  if (!market) return "Tax";
  switch (market.taxStrategy) {
    case "sales_tax":
      return "Sales tax";
    case "gst":
      return "GST/HST";
    case "vat":
    default:
      return market.countryCode === "NO" ? "MVA" : "VAT";
  }
}

/**
 * Lovpålagt reverse charge-tekst (EU/GB). Rendres KUN når markedet støtter
 * reverse charge og kjøper kvalifiserer — aldri utledet fra språk.
 */
export function reverseChargeNote(countryCode: string): string | null {
  const market = getMarketCountry(countryCode);
  if (!market) return null;
  if (market.taxStrategy !== "vat") return null;
  return "Reverse charge — VAT to be accounted for by the recipient (Article 196, Council Directive 2006/112/EC).";
}

/** Tekstlinje for skattefritak; grunnkoden må være godkjent for markedet. */
export function taxExemptNote(reasonCode: string): string | null {
  const code = String(reasonCode ?? "").trim();
  if (!code) return null;
  return `Tax exempt — reason: ${code}`;
}
