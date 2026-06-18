// lib/providers/providerCustomerDetailSurface.ts
// Provider customer detail display helpers (identity, billing, layout copy).

import { providerCustomerStatusLabel, type ProviderCustomerStatus } from "@/lib/providers/customerTypes";
import {
  formatDeliveryAddressInline,
  formatNok,
  type ProviderBillingBasis,
  type ProviderInvoiceSettings,
} from "@/lib/providers/providerCustomerBilling";
import { agreementStatusLabel } from "@/lib/providers/providerCustomerAgreementSurface";

export const PROVIDER_CUSTOMER_DETAIL_COPY = {
  identityTitle: "Kundeinformasjon",
  billingBasisTitle: "Fakturagrunnlag",
  orgnrMissing: "Org.nr ikke registrert",
  contactMissing: "—",
  agreementStatusMissing: "Ingen aktiv avtale",
  billingIncomplete: "Fakturagrunnlag ikke komplett",
  labels: {
    orgnr: "Org.nr",
    contact: "Kontakt",
    email: "E-post",
    phone: "Telefon",
    deliveryAddress: "Leveringsadresse",
    agreementStatus: "Avtalestatus",
    ordersThisMonth: "Ordre denne måneden",
    revenue: "Omsetning",
    commission: "Lunchportalen-provisjon",
    invoiceMethod: "Fakturametode",
    invoiceRecipient: "Fakturamottaker",
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
  ordersLabel: string;
  revenueLabel: string;
  commissionLabel: string;
  methodLabel: string;
  recipientLabel: string;
  incomplete: boolean;
};

export function buildBillingBasisDisplay(
  basis: ProviderBillingBasis,
  invoice: ProviderInvoiceSettings,
): ProviderBillingBasisDisplay {
  return {
    ordersLabel: String(basis.ordersThisMonth),
    revenueLabel: basis.complete ? formatNok(basis.revenueNok) : PROVIDER_CUSTOMER_DETAIL_COPY.billingIncomplete,
    commissionLabel: basis.complete
      ? `${formatNok(basis.commissionNok)} (${basis.commissionRateLabel})`
      : PROVIDER_CUSTOMER_DETAIL_COPY.billingIncomplete,
    methodLabel: invoice.methodLabel,
    recipientLabel: invoice.recipientLabel,
    incomplete: !basis.complete,
  };
}
