// lib/providers/providerCustomerBilling.ts
// Provider-facing billing identity helpers (read-model / display / validation shapes).

import { digitsOnlyOrgnr, isValidNorwegianOrgnr } from "@/lib/orgnr/no";

export type InvoiceMethod = "EMAIL" | "EHF";

/** Stable presentation id for invoice method — map via provider.customers.billing.method.* */
export type InvoiceMethodPresentationKey = "email" | "ehf" | "notSelected";

/** Stable presentation id for commission base — map via provider.customers.billing.commissionBase.* */
export type CommissionBasePresentationKey = "taxEx" | "taxInc" | "notAvailable";

export const LUNCHPORTALEN_COMMISSION_RATE = 0.05;

export type ProviderBillingContact = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type ProviderInvoiceSettings = {
  method: InvoiceMethod | null;
  methodKey: InvoiceMethodPresentationKey;
  invoiceEmail: string | null;
  orgnr: string | null;
  ehfEndpoint: string | null;
  ehfEnabled: boolean;
  billingContact: ProviderBillingContact;
  /** Resolved invoice recipient (email or EHF endpoint), null when not configured. */
  recipientValue: string | null;
  /** @deprecated Use methodKey + i18n — kept for agreement read model consumers. */
  methodLabel: string;
  /** @deprecated Use recipientValue + i18n — kept for agreement read model consumers. */
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
  commissionBaseKey: CommissionBasePresentationKey;
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

export function invoiceMethodPresentationKey(method: InvoiceMethod | null): InvoiceMethodPresentationKey {
  if (method === "EHF") return "ehf";
  if (method === "EMAIL") return "email";
  return "notSelected";
}

/** @deprecated Use invoiceMethodPresentationKey + provider.customers.billing.method.* i18n. */
export function invoiceMethodLabel(method: InvoiceMethod | null): string {
  if (method === "EHF") return "EHF";
  if (method === "EMAIL") return "E-post";
  return "Ikke valgt";
}

export function resolveInvoiceRecipientValue(settings: {
  method: InvoiceMethod | null;
  invoiceEmail: string | null;
  ehfEndpoint: string | null;
}): string | null {
  if (settings.method === "EHF" && settings.ehfEndpoint) return settings.ehfEndpoint;
  if (settings.method === "EMAIL" && settings.invoiceEmail) return settings.invoiceEmail;
  return null;
}

export function hasInvoiceRecipient(
  settings: Pick<ProviderInvoiceSettings, "method" | "recipientValue">,
): boolean {
  return Boolean(settings.method && settings.recipientValue);
}

/** @deprecated Use resolveInvoiceRecipientValue + i18n for empty state. */
export function buildInvoiceRecipientLabel(settings: {
  method: InvoiceMethod | null;
  invoiceEmail: string | null;
  ehfEndpoint: string | null;
}): string {
  const value = resolveInvoiceRecipientValue(settings);
  return value ?? "Ikke valgt";
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

  const recipientValue = resolveInvoiceRecipientValue({ method, invoiceEmail, ehfEndpoint });

  return {
    method,
    methodKey: invoiceMethodPresentationKey(method),
    invoiceEmail,
    orgnr,
    ehfEndpoint,
    ehfEnabled,
    billingContact: {
      name: safeStr(input.contactName) || null,
      email: safeStr(input.contactEmail).toLowerCase() || null,
      phone: safeStr(input.contactPhone) || null,
    },
    recipientValue,
    methodLabel: invoiceMethodLabel(method),
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
  let commissionBaseKey: CommissionBasePresentationKey = "notAvailable";

  if (ordersThisMonth === 0 && !hasGross && !hasExVat) {
    confidence = "incomplete";
  } else if (hasExVat && hasVat && hasGross) {
    confidence = "complete";
    commissionBase = input.revenueExVatNok!;
    commissionBaseKey = "taxEx";
  } else if (hasGross) {
    confidence = "gross_only";
    commissionBase = revenueIncVatNok;
    commissionBaseKey = "taxInc";
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
    commissionBaseKey,
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
