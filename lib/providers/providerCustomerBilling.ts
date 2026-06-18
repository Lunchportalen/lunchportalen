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

export type ProviderBillingBasis = {
  ordersThisMonth: number;
  revenueNok: number;
  commissionNok: number;
  commissionRateLabel: string;
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
  revenueNok: number;
}): ProviderBillingBasis {
  const ordersThisMonth = Math.max(0, Math.floor(input.ordersThisMonth));
  const revenueNok = Number.isFinite(input.revenueNok) && input.revenueNok >= 0 ? input.revenueNok : 0;
  const commissionNok = Math.round(revenueNok * LUNCHPORTALEN_COMMISSION_RATE * 100) / 100;
  return {
    ordersThisMonth,
    revenueNok,
    commissionNok,
    commissionRateLabel: "5 %",
    complete: ordersThisMonth > 0 || revenueNok > 0,
  };
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
