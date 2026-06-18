// lib/providers/providerCustomerBilling.ts
// Provider-facing billing identity helpers (read-model / display / validation shapes).

import { digitsOnlyOrgnr, isValidNorwegianOrgnr } from "@/lib/orgnr/no";

export type InvoiceMethod = "EMAIL" | "EHF";

export const LUNCHPORTALEN_COMMISSION_RATE = 0.05;

export type ProviderBillingContact = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type ProviderInvoiceSettings = {
  method: InvoiceMethod | null;
  methodLabel: string;
  invoiceEmail: string | null;
  orgnr: string | null;
  ehfEndpoint: string | null;
  ehfEnabled: boolean;
  billingContact: ProviderBillingContact;
  recipientLabel: string;
};

export type ProviderBillingBasisConfidence = "complete" | "gross_only" | "incomplete";

export type ProviderBillingBasis = {
  ordersThisMonth: number;
  revenueExVatNok: number | null;
  vatNok: number | null;
  revenueIncVatNok: number;
  commissionNok: number;
  commissionRateLabel: string;
  commissionBaseLabel: string;
  confidence: ProviderBillingBasisConfidence;
  /** @deprecated use confidence + labeled fields */
  complete: boolean;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export function resolveCompanyOrgnr(orgnr: unknown, organizationNumber: unknown): string | null {
  const primary = digitsOnlyOrgnr(orgnr);
  if (primary.length === 9) return primary;
  const fallback = digitsOnlyOrgnr(organizationNumber);
  if (fallback.length === 9) return fallback;
  const raw = safeStr(orgnr) || safeStr(organizationNumber);
  return raw || null;
}

export function suggestEhfEndpoint(orgnr: unknown): string | null {
  const digits = digitsOnlyOrgnr(orgnr);
  if (!isValidNorwegianOrgnr(digits)) return null;
  return `0192:${digits}`;
}

export function resolveInvoiceMethod(input: {
  ehfEnabled?: unknown;
  ehfEndpoint?: unknown;
  billingEmail?: unknown;
}): InvoiceMethod | null {
  if (Boolean(input.ehfEnabled) && safeStr(input.ehfEndpoint)) return "EHF";
  if (safeStr(input.billingEmail)) return "EMAIL";
  return null;
}

export function invoiceMethodLabel(method: InvoiceMethod | null): string {
  if (method === "EHF") return "EHF";
  if (method === "EMAIL") return "E-post";
  return "Ikke valgt";
}

export function buildInvoiceRecipientLabel(settings: {
  method: InvoiceMethod | null;
  invoiceEmail: string | null;
  ehfEndpoint: string | null;
}): string {
  if (settings.method === "EHF" && settings.ehfEndpoint) return settings.ehfEndpoint;
  if (settings.method === "EMAIL" && settings.invoiceEmail) return settings.invoiceEmail;
  return "Ikke valgt";
}

export function buildProviderInvoiceSettings(input: {
  orgnr?: unknown;
  organizationNumber?: unknown;
  billingEmail?: unknown;
  ehfEnabled?: unknown;
  ehfEndpoint?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
}): ProviderInvoiceSettings {
  const orgnr = resolveCompanyOrgnr(input.orgnr, input.organizationNumber);
  const invoiceEmail = safeStr(input.billingEmail).toLowerCase() || null;
  const ehfEndpoint = safeStr(input.ehfEndpoint) || null;
  const ehfEnabled = Boolean(input.ehfEnabled);
  const method = resolveInvoiceMethod({ ehfEnabled, ehfEndpoint, billingEmail: invoiceEmail });

  return {
    method,
    methodLabel: invoiceMethodLabel(method),
    invoiceEmail,
    orgnr,
    ehfEndpoint,
    ehfEnabled,
    billingContact: {
      name: safeStr(input.contactName) || null,
      email: safeStr(input.contactEmail).toLowerCase() || null,
      phone: safeStr(input.contactPhone) || null,
    },
    recipientLabel: buildInvoiceRecipientLabel({ method, invoiceEmail, ehfEndpoint }),
  };
}

export function computeBillingBasis(input: {
  ordersThisMonth: number;
  revenueExVatNok?: number | null;
  vatNok?: number | null;
  revenueIncVatNok?: number;
  /** @deprecated use revenueIncVatNok */
  revenueNok?: number;
}): ProviderBillingBasis {
  const ordersThisMonth = Math.max(0, Math.floor(input.ordersThisMonth));
  const revenueIncVatNok =
    Number.isFinite(input.revenueIncVatNok) && input.revenueIncVatNok! >= 0
      ? input.revenueIncVatNok!
      : Number.isFinite(input.revenueNok) && input.revenueNok! >= 0
        ? input.revenueNok!
        : 0;

  const hasExVat = input.revenueExVatNok != null && Number.isFinite(input.revenueExVatNok) && input.revenueExVatNok >= 0;
  const hasVat = input.vatNok != null && Number.isFinite(input.vatNok) && input.vatNok >= 0;
  const hasGross = revenueIncVatNok > 0;

  let confidence: ProviderBillingBasisConfidence = "incomplete";
  let commissionBase = 0;
  let commissionBaseLabel = "Ikke tilgjengelig";

  if (ordersThisMonth === 0 && !hasGross && !hasExVat) {
    confidence = "incomplete";
  } else if (hasExVat && hasVat && hasGross) {
    confidence = "complete";
    commissionBase = input.revenueExVatNok!;
    commissionBaseLabel = "eks. mva";
  } else if (hasGross) {
    confidence = "gross_only";
    commissionBase = revenueIncVatNok;
    commissionBaseLabel = "inkl. mva";
  } else {
    confidence = "incomplete";
  }

  const commissionNok =
    confidence === "incomplete" ? 0 : Math.round(commissionBase * LUNCHPORTALEN_COMMISSION_RATE * 100) / 100;

  return {
    ordersThisMonth,
    revenueExVatNok: hasExVat ? input.revenueExVatNok! : null,
    vatNok: hasVat ? input.vatNok! : null,
    revenueIncVatNok,
    commissionNok,
    commissionRateLabel: "5 %",
    commissionBaseLabel,
    confidence,
    complete: confidence !== "incomplete",
  };
}

export function sumOrderRevenueCents(
  rows: ReadonlyArray<{
    gross_cents_inc_vat?: unknown;
    subtotal_cents_ex_vat?: unknown;
    vat_cents?: unknown;
  }>,
): {
  revenueExVatNok: number;
  vatNok: number;
  revenueIncVatNok: number;
  hasExVat: boolean;
  hasVat: boolean;
  hasGross: boolean;
} {
  let exCents = 0;
  let vatCents = 0;
  let grossCents = 0;
  let hasExVat = false;
  let hasVat = false;
  let hasGross = false;

  for (const row of rows) {
    const gross = safeNum(row.gross_cents_inc_vat);
    const ex = safeNum(row.subtotal_cents_ex_vat);
    const vat = safeNum(row.vat_cents);
    if (gross > 0) {
      grossCents += gross;
      hasGross = true;
    }
    if (ex > 0) {
      exCents += ex;
      hasExVat = true;
    }
    if (vat > 0) {
      vatCents += vat;
      hasVat = true;
    }
  }

  return {
    revenueExVatNok: exCents / 100,
    vatNok: vatCents / 100,
    revenueIncVatNok: grossCents / 100,
    hasExVat,
    hasVat,
    hasGross,
  };
}

function safeNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function formatDeliveryAddress(input: {
  locationName?: string | null;
  locationAddress?: string | null;
  companyAddress?: string | null;
}): string {
  const name = safeStr(input.locationName);
  const address = safeStr(input.locationAddress) || safeStr(input.companyAddress);
  if (name && address) return `${name}\n${address}`;
  if (address) return address;
  if (name) return name;
  return "Leveringsadresse ikke satt";
}

export function formatDeliveryAddressInline(input: {
  locationName?: string | null;
  locationAddress?: string | null;
  companyAddress?: string | null;
}): string {
  return formatDeliveryAddress(input).replace(/\n/g, ", ");
}

export function formatNok(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
