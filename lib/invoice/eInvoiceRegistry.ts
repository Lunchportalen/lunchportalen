/**
 * Country-aware e-invoice capability registry (Phase 15G.1).
 * Adapters are scaffolding only — no fake legal invoices in staging/production.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";

export type EInvoiceChannel = "pdf_email" | "peppol" | "national_ctc" | "accounting_export";

export type AdapterStatus = "NOT_BUILT" | "STUB" | "STAGING_READY" | "PRODUCTION_READY" | "NOT_APPLICABLE";

export type RequirementStatus = "RESEARCHED" | "REQUIRED" | "OPTIONAL" | "NOT_APPLICABLE" | "APPROVED";

export type CountryEInvoiceCapability = {
  countryCode: CountryCode;
  channels: readonly EInvoiceChannel[];
  requirementStatus: RequirementStatus;
  adapterStatus: AdapterStatus;
  officialSourceUrl: string | null;
  effectiveDate: string | null;
  stagingDeliveryProof: null;
  reviewerApproval: "NONE" | "APPROVED";
  notes: string;
};

function cap(
  countryCode: CountryCode,
  partial: Partial<CountryEInvoiceCapability> & Pick<CountryEInvoiceCapability, "notes">,
): CountryEInvoiceCapability {
  return {
    countryCode,
    channels: ["pdf_email", "accounting_export"],
    requirementStatus: "RESEARCHED",
    adapterStatus: "STUB",
    officialSourceUrl: null,
    effectiveDate: null,
    stagingDeliveryProof: null,
    reviewerApproval: "NONE",
    ...partial,
  };
}

export const E_INVOICE_CAPABILITIES: Record<CountryCode, CountryEInvoiceCapability> = {
  NO: cap("NO", {
    channels: ["pdf_email", "peppol", "accounting_export"],
    officialSourceUrl: "https://www.skatteetaten.no/",
    notes: "Norwegian Peppol profile researched; adapter STUB; no staging legal invoice issuance.",
  }),
  SE: cap("SE", { channels: ["pdf_email", "peppol", "accounting_export"], notes: "Peppol researched; STUB." }),
  DK: cap("DK", { channels: ["pdf_email", "peppol", "accounting_export"], notes: "NemHandel/Peppol researched; STUB." }),
  FI: cap("FI", { channels: ["pdf_email", "peppol", "accounting_export"], notes: "Peppol researched; STUB." }),
  GB: cap("GB", {
    channels: ["pdf_email", "accounting_export"],
    requirementStatus: "OPTIONAL",
    notes: "PDF/email baseline; no UK CTC mandate assumed without primary source.",
  }),
  DE: cap("DE", { channels: ["pdf_email", "peppol", "national_ctc", "accounting_export"], notes: "XRechnung/Peppol researched; STUB." }),
  FR: cap("FR", { channels: ["pdf_email", "national_ctc", "accounting_export"], notes: "Factur-X / CTC path researched; STUB." }),
  ES: cap("ES", { channels: ["pdf_email", "national_ctc", "accounting_export"], notes: "TicketBAI/VeriFactu path researched; STUB." }),
  IT: cap("IT", { channels: ["pdf_email", "national_ctc", "accounting_export"], notes: "SdI researched; STUB." }),
  NL: cap("NL", { channels: ["pdf_email", "peppol", "accounting_export"], notes: "Peppol researched; STUB." }),
  BE: cap("BE", { channels: ["pdf_email", "peppol", "accounting_export"], notes: "Peppol researched; STUB." }),
  CH: cap("CH", { channels: ["pdf_email", "accounting_export"], notes: "PDF/email baseline; STUB." }),
  AT: cap("AT", { channels: ["pdf_email", "peppol", "accounting_export"], notes: "Peppol researched; STUB." }),
  IE: cap("IE", { channels: ["pdf_email", "peppol", "accounting_export"], notes: "Peppol researched; STUB." }),
  PL: cap("PL", { channels: ["pdf_email", "national_ctc", "accounting_export"], notes: "KSeF researched; STUB." }),
  RO: cap("RO", { channels: ["pdf_email", "national_ctc", "accounting_export"], notes: "RO e-Factura researched; STUB." }),
  CZ: cap("CZ", { channels: ["pdf_email", "accounting_export"], notes: "PDF/email baseline; STUB." }),
  PT: cap("PT", { channels: ["pdf_email", "national_ctc", "accounting_export"], notes: "ATCUD/e-fatura researched; STUB." }),
  GR: cap("GR", { channels: ["pdf_email", "national_ctc", "accounting_export"], notes: "myDATA researched; STUB." }),
  US: cap("US", {
    channels: ["pdf_email", "accounting_export"],
    requirementStatus: "NOT_APPLICABLE",
    adapterStatus: "NOT_APPLICABLE",
    notes: "No national e-invoice mandate; PDF/email + accounting export only.",
  }),
  CA: cap("CA", {
    channels: ["pdf_email", "accounting_export"],
    requirementStatus: "OPTIONAL",
    notes: "PDF/email baseline; provincial e-invoicing not assumed without primary source.",
  }),
};

export function countEInvoiceApprovals(): {
  approvedOrNa: number;
  none: number;
  total: number;
} {
  let approvedOrNa = 0;
  let none = 0;
  for (const c of SUPPORTED_COUNTRY_CODES) {
    const capab = E_INVOICE_CAPABILITIES[c];
    if (capab.reviewerApproval === "APPROVED" || capab.requirementStatus === "NOT_APPLICABLE") {
      approvedOrNa += 1;
    } else {
      none += 1;
    }
  }
  return { approvedOrNa, none, total: SUPPORTED_COUNTRY_CODES.length };
}

/** Staging/production must not emit legally binding invoices from STUB adapters. */
export function assertNoFakeLegalInvoiceIssuance(countryCode: CountryCode): void {
  const c = E_INVOICE_CAPABILITIES[countryCode];
  if (c.adapterStatus === "STUB" || c.adapterStatus === "NOT_BUILT") {
    throw new Error(`FAKE_LEGAL_INVOICE_FORBIDDEN:${countryCode}:${c.adapterStatus}`);
  }
  if (c.reviewerApproval !== "APPROVED" && c.requirementStatus !== "NOT_APPLICABLE") {
    throw new Error(`E_INVOICE_NOT_APPROVED:${countryCode}`);
  }
}
