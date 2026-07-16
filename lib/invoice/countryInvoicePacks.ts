/**
 * Country invoice / credit-note technical packs (Phase 15G.2).
 * reviewStatus stays RESEARCHED until human invoice approval.
 * Staging/production must not issue legally binding invoices from STUB packs.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES, SUPPORTED_MARKETS } from "@/lib/markets/supportedMarkets";
import { E_INVOICE_CAPABILITIES } from "@/lib/invoice/eInvoiceRegistry";

export type InvoicePackReviewStatus = "RESEARCHED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export type CountryInvoicePack = {
  countryCode: CountryCode;
  currencyCode: string;
  supportsSimplifiedInvoice: boolean;
  numberingScheme: "sequential_per_issuer" | "sequential_per_year" | "pending";
  requiresTaxIdOnInvoice: boolean;
  reverseChargeWordingKey: string | null;
  creditNoteRequiresOriginalLink: true;
  roundingMode: "half_up";
  retentionYears: number | null;
  reviewStatus: InvoicePackReviewStatus;
  officialSourceUrl: string | null;
  stagingIssuanceAllowed: false;
};

function currencyFor(countryCode: CountryCode): string {
  const m = SUPPORTED_MARKETS.find((x) => x.countryCode === countryCode);
  if (!m) throw new Error(`MARKET_MISSING:${countryCode}`);
  return m.currency;
}

function pack(countryCode: CountryCode, partial?: Partial<CountryInvoicePack>): CountryInvoicePack {
  return {
    countryCode,
    currencyCode: currencyFor(countryCode),
    supportsSimplifiedInvoice: countryCode !== "IT" && countryCode !== "PL",
    numberingScheme: "sequential_per_issuer",
    requiresTaxIdOnInvoice: true,
    reverseChargeWordingKey: countryCode === "US" ? null : `${countryCode.toLowerCase()}.invoice.reverse_charge`,
    creditNoteRequiresOriginalLink: true,
    roundingMode: "half_up",
    retentionYears: countryCode === "NO" ? 5 : null,
    reviewStatus: "RESEARCHED",
    officialSourceUrl: null,
    stagingIssuanceAllowed: false,
    ...partial,
  };
}

export const COUNTRY_INVOICE_PACKS: Record<CountryCode, CountryInvoicePack> = {
  NO: pack("NO", { officialSourceUrl: "https://www.skatteetaten.no/", retentionYears: 5 }),
  SE: pack("SE", { officialSourceUrl: "https://www.skatteverket.se/" }),
  DK: pack("DK", { officialSourceUrl: "https://skat.dk/" }),
  FI: pack("FI", { officialSourceUrl: "https://www.vero.fi/" }),
  GB: pack("GB", { officialSourceUrl: "https://www.gov.uk/vat-record-keeping" }),
  DE: pack("DE", { officialSourceUrl: "https://www.bundesfinanzministerium.de/" }),
  FR: pack("FR", { officialSourceUrl: "https://www.impots.gouv.fr/" }),
  ES: pack("ES", { officialSourceUrl: "https://sede.agenciatributaria.gob.es/" }),
  IT: pack("IT", { officialSourceUrl: "https://www.agenziaentrate.gov.it/", supportsSimplifiedInvoice: false }),
  NL: pack("NL", { officialSourceUrl: "https://www.belastingdienst.nl/" }),
  BE: pack("BE", { officialSourceUrl: "https://finance.belgium.be/" }),
  CH: pack("CH", { officialSourceUrl: "https://www.estv.admin.ch/" }),
  AT: pack("AT", { officialSourceUrl: "https://www.bmf.gv.at/" }),
  IE: pack("IE", { officialSourceUrl: "https://www.revenue.ie/" }),
  PL: pack("PL", { officialSourceUrl: "https://www.podatki.gov.pl/", supportsSimplifiedInvoice: false }),
  RO: pack("RO", { officialSourceUrl: "https://www.anaf.ro/" }),
  CZ: pack("CZ", { officialSourceUrl: "https://www.financnisprava.cz/" }),
  PT: pack("PT", { officialSourceUrl: "https://www.portaldasfinancas.gov.pt/" }),
  GR: pack("GR", { officialSourceUrl: "https://www.aade.gr/" }),
  US: pack("US", { reverseChargeWordingKey: null, retentionYears: 7 }),
  CA: pack("CA", { officialSourceUrl: "https://www.canada.ca/en/revenue-agency.html", retentionYears: 6 }),
};

export function assertAllInvoicePacksPresent(): void {
  for (const c of SUPPORTED_COUNTRY_CODES) {
    if (!COUNTRY_INVOICE_PACKS[c]) throw new Error(`INVOICE_PACK_MISSING:${c}`);
    if (COUNTRY_INVOICE_PACKS[c].reviewStatus === "APPROVED") {
      throw new Error(`FORGED_INVOICE_APPROVAL:${c}`);
    }
    if (COUNTRY_INVOICE_PACKS[c].stagingIssuanceAllowed) {
      throw new Error(`STAGING_LEGAL_INVOICE_FORBIDDEN:${c}`);
    }
  }
}

export function assertInvoiceIssuanceAllowed(countryCode: CountryCode): void {
  const p = COUNTRY_INVOICE_PACKS[countryCode];
  if (p.reviewStatus !== "APPROVED") {
    throw new Error(`INVOICE_NOT_APPROVED:${countryCode}:${p.reviewStatus}`);
  }
  const e = E_INVOICE_CAPABILITIES[countryCode];
  if (e.reviewerApproval !== "APPROVED" && e.requirementStatus !== "NOT_APPLICABLE") {
    throw new Error(`E_INVOICE_NOT_READY:${countryCode}`);
  }
}

export type CreditNoteDraft = {
  countryCode: CountryCode;
  originalInvoiceId: string;
  currencyCode: string;
  amountMinor: bigint;
  taxAmountMinor: bigint;
  reason: string;
};

export function buildCreditNoteDraft(args: {
  countryCode: CountryCode;
  originalInvoiceId: string;
  currencyCode: string;
  amountMinor: bigint;
  taxAmountMinor: bigint;
  reason: string;
}): CreditNoteDraft {
  const invoicePack = COUNTRY_INVOICE_PACKS[args.countryCode];
  if (args.currencyCode !== invoicePack.currencyCode) {
    throw new Error(`CROSS_CURRENCY_INVOICE_FORBIDDEN:${args.currencyCode}->${invoicePack.currencyCode}`);
  }
  if (!args.originalInvoiceId.trim()) {
    throw new Error("CREDIT_NOTE_REQUIRES_ORIGINAL");
  }
  if (!invoicePack.creditNoteRequiresOriginalLink) {
    throw new Error("CREDIT_NOTE_LINK_REQUIRED");
  }
  return {
    countryCode: args.countryCode,
    originalInvoiceId: args.originalInvoiceId,
    currencyCode: args.currencyCode,
    amountMinor: args.amountMinor,
    taxAmountMinor: args.taxAmountMinor,
    reason: args.reason,
  };
}
