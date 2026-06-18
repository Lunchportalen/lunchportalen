// lib/providers/providerCustomerDetailSurface.ts
// Provider customer detail display helpers (identity, billing, layout copy).

import { providerCustomerStatusLabel, type ProviderCustomerStatus } from "@/lib/providers/customerTypes";
import {
  formatDeliveryAddressInline,
  formatNok,
  type ProviderBillingBasis,
  type ProviderBillingBasisConfidence,
  type ProviderInvoiceSettings,
} from "@/lib/providers/providerCustomerBilling";
import { agreementStatusLabel } from "@/lib/providers/providerCustomerAgreementSurface";

export const PROVIDER_CUSTOMER_DETAIL_COPY = {
  identityTitle: "Kundeinformasjon",
  billingBasisTitle: "Fakturagrunnlag",
  billingPeriodLabel: "Siste 30 dager",
  orgnrMissing: "Org.nr ikke registrert",
  contactMissing: "—",
  agreementStatusMissing: "Ingen aktiv avtale",
  billingIncomplete: "Fakturagrunnlag ikke komplett",
  vatNotSpecified: "Ikke spesifisert",
  grossOnlyNote:
    "Tallene vises inkl. mva fordi ordregrunnlaget mangler separat mva-splitt.",
  completeCommissionNote: "Provisjon beregnes av omsetning eks. mva.",
  billingStatus: {
    ready: "Klar til fakturagrunnlag",
    missingVat: "Mangler mva-splitt",
    missingRecipient: "Mangler fakturamottaker",
    missingOrders: "Mangler ordregrunnlag",
  },
  labels: {
    orgnr: "Org.nr",
    contact: "Kontakt",
    email: "E-post",
    phone: "Telefon",
    deliveryAddress: "Leveringsadresse",
    agreementStatus: "Avtalestatus",
    period: "Periode",
    ordersThisMonth: "Ordregrunnlag",
    revenueExVat: "Omsetning eks. mva",
    vat: "Mva",
    revenueIncVat: "Omsetning inkl. mva",
    commissionBase: "Provisjonsgrunnlag",
    commission: "Provisjon 5 %",
    commissionRate: "Provisjonssats",
    invoiceMethod: "Fakturametode",
    invoiceRecipient: "Fakturamottaker",
    billingStatus: "Status",
  },
} as const;

export type ProviderCustomerIdentityDisplay = {
  companyName: string;
  orgnrLabel: string;
  statusLabel: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  deliveryAddress: string;
  agreementStatusLabel: string;
};

export function buildCustomerIdentityDisplay(input: {
  companyName: string;
  orgnr: string | null;
  status: ProviderCustomerStatus;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  companyAddress?: string | null;
  activeAgreementStatus?: string | null;
}): ProviderCustomerIdentityDisplay {
  const orgnr = String(input.orgnr ?? "").trim();
  return {
    companyName: input.companyName,
    orgnrLabel: orgnr ? orgnr : PROVIDER_CUSTOMER_DETAIL_COPY.orgnrMissing,
    statusLabel: providerCustomerStatusLabel(input.status),
    contactName: String(input.contactName ?? "").trim() || PROVIDER_CUSTOMER_DETAIL_COPY.contactMissing,
    contactEmail: String(input.contactEmail ?? "").trim() || PROVIDER_CUSTOMER_DETAIL_COPY.contactMissing,
    contactPhone: String(input.contactPhone ?? "").trim() || PROVIDER_CUSTOMER_DETAIL_COPY.contactMissing,
    deliveryAddress: formatDeliveryAddressInline({
      locationName: input.locationName,
      locationAddress: input.locationAddress,
      companyAddress: input.companyAddress,
    }),
    agreementStatusLabel: input.activeAgreementStatus
      ? agreementStatusLabel(input.activeAgreementStatus)
      : PROVIDER_CUSTOMER_DETAIL_COPY.agreementStatusMissing,
  };
}

export type ProviderBillingBasisDisplay = {
  periodLabel: string;
  ordersLabel: string;
  revenueExVatLabel: string;
  vatLabel: string;
  revenueIncVatLabel: string;
  commissionBaseLabel: string;
  commissionAmountLabel: string;
  commissionRateLabel: "5 %";
  methodLabel: string;
  recipientLabel: string;
  statusLabel: string;
  confidence: ProviderBillingBasisConfidence;
  note: string | null;
};

export function buildBillingBasisStatusLabel(
  basis: ProviderBillingBasis,
  invoice: ProviderInvoiceSettings,
): string {
  if (basis.ordersThisMonth === 0 && basis.confidence === "incomplete") {
    return PROVIDER_CUSTOMER_DETAIL_COPY.billingStatus.missingOrders;
  }
  if (basis.confidence === "incomplete") {
    return PROVIDER_CUSTOMER_DETAIL_COPY.billingStatus.missingVat;
  }
  if (!invoice.method || invoice.recipientLabel === "Ikke valgt") {
    return PROVIDER_CUSTOMER_DETAIL_COPY.billingStatus.missingRecipient;
  }
  return PROVIDER_CUSTOMER_DETAIL_COPY.billingStatus.ready;
}

export function buildBillingBasisBadges(
  basis: ProviderBillingBasis,
): { ordersBadge: string; commissionBadge: string } {
  const ordersBadge =
    basis.ordersThisMonth === 1
      ? "1 ordre denne måneden"
      : `${basis.ordersThisMonth} ordre denne måneden`;
  const commissionBadge =
    basis.confidence === "incomplete"
      ? "Provisjon ikke klar"
      : `${formatNok(basis.commissionNok)} provisjon`;
  return { ordersBadge, commissionBadge };
}

export function buildBillingBasisDisplay(
  basis: ProviderBillingBasis,
  invoice: ProviderInvoiceSettings,
): ProviderBillingBasisDisplay {
  const incomplete = basis.confidence === "incomplete";

  return {
    periodLabel: PROVIDER_CUSTOMER_DETAIL_COPY.billingPeriodLabel,
    ordersLabel: String(basis.ordersThisMonth),
    revenueExVatLabel:
      basis.confidence === "complete" && basis.revenueExVatNok != null
        ? formatNok(basis.revenueExVatNok)
        : incomplete
          ? PROVIDER_CUSTOMER_DETAIL_COPY.billingIncomplete
          : PROVIDER_CUSTOMER_DETAIL_COPY.vatNotSpecified,
    vatLabel:
      basis.confidence === "complete" && basis.vatNok != null
        ? formatNok(basis.vatNok)
        : incomplete
          ? PROVIDER_CUSTOMER_DETAIL_COPY.billingIncomplete
          : PROVIDER_CUSTOMER_DETAIL_COPY.vatNotSpecified,
    revenueIncVatLabel:
      basis.confidence !== "incomplete" && basis.revenueIncVatNok > 0
        ? formatNok(basis.revenueIncVatNok)
        : PROVIDER_CUSTOMER_DETAIL_COPY.billingIncomplete,
    commissionBaseLabel:
      basis.confidence === "incomplete"
        ? PROVIDER_CUSTOMER_DETAIL_COPY.billingIncomplete
        : basis.commissionBaseLabel,
    commissionAmountLabel:
      basis.confidence === "incomplete"
        ? PROVIDER_CUSTOMER_DETAIL_COPY.billingIncomplete
        : formatNok(basis.commissionNok),
    commissionRateLabel: "5 %",
    methodLabel: invoice.methodLabel,
    recipientLabel: invoice.recipientLabel,
    statusLabel: buildBillingBasisStatusLabel(basis, invoice),
    confidence: basis.confidence,
    note:
      basis.confidence === "gross_only"
        ? PROVIDER_CUSTOMER_DETAIL_COPY.grossOnlyNote
        : basis.confidence === "complete"
          ? PROVIDER_CUSTOMER_DETAIL_COPY.completeCommissionNote
          : null,
  };
}
