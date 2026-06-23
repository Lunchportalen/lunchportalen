// lib/providers/providerCustomerDetailSurface.ts
// Provider customer detail display helpers (identity, billing) — i18n via translator callback.

import type { ProviderCustomerStatus } from "@/lib/providers/customerTypes";
import {
  formatDeliveryAddressInline,
  formatNok,
  type ProviderBillingBasis,
  type ProviderBillingBasisConfidence,
  type ProviderInvoiceSettings,
} from "@/lib/providers/providerCustomerBilling";
import { agreementStatusLabel } from "@/lib/providers/providerCustomerAgreementSurface";

export type ProviderCustomerDetailTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export type ProviderCustomerStatusTranslate = (key: ProviderCustomerStatus extends infer _ ? string : never) => string;

export type ProviderCustomerDetailTranslators = {
  tDetail: ProviderCustomerDetailTranslate;
  tStatus: (key: "active" | "paused" | "suspended" | "deleted") => string;
  tAgreementStatus: (key: string) => string;
};

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

export function buildCustomerIdentityDisplay(
  input: {
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
  },
  { tDetail, tStatus, tAgreementStatus }: ProviderCustomerDetailTranslators,
): ProviderCustomerIdentityDisplay {
  const orgnr = String(input.orgnr ?? "").trim();
  const missing = tDetail("contactMissing");
  return {
    companyName: input.companyName,
    orgnrLabel: orgnr ? orgnr : tDetail("orgnrMissing"),
    statusLabel: tStatus(
      input.status === "ACTIVE"
        ? "active"
        : input.status === "PAUSED"
          ? "paused"
          : input.status === "SUSPENDED"
            ? "suspended"
            : "deleted",
    ),
    contactName: String(input.contactName ?? "").trim() || missing,
    contactEmail: String(input.contactEmail ?? "").trim() || missing,
    contactPhone: String(input.contactPhone ?? "").trim() || missing,
    deliveryAddress: formatDeliveryAddressInline({
      locationName: input.locationName,
      locationAddress: input.locationAddress,
      companyAddress: input.companyAddress,
    }),
    agreementStatusLabel: input.activeAgreementStatus
      ? agreementStatusLabel(input.activeAgreementStatus, tAgreementStatus)
      : tDetail("agreementStatusMissing"),
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
  commissionRateLabel: string;
  methodLabel: string;
  recipientLabel: string;
  statusLabel: string;
  confidence: ProviderBillingBasisConfidence;
  note: string | null;
};

export function buildBillingBasisStatusLabel(
  basis: ProviderBillingBasis,
  invoice: ProviderInvoiceSettings,
  tDetail: ProviderCustomerDetailTranslate,
): string {
  if (basis.ordersThisMonth === 0 && basis.confidence === "incomplete") {
    return tDetail("billingStatus.missingOrders");
  }
  if (basis.confidence === "incomplete") {
    return tDetail("billingStatus.missingVat");
  }
  if (!invoice.method || invoice.recipientLabel === "Ikke valgt") {
    return tDetail("billingStatus.missingRecipient");
  }
  return tDetail("billingStatus.ready");
}

export function buildBillingBasisBadges(
  basis: ProviderBillingBasis,
  tDetail: ProviderCustomerDetailTranslate,
): { ordersBadge: string; commissionBadge: string } {
  const ordersBadge =
    basis.ordersThisMonth === 1
      ? tDetail("badges.oneOrderThisMonth")
      : tDetail("badges.ordersThisMonth", { count: basis.ordersThisMonth });
  const commissionBadge =
    basis.confidence === "incomplete"
      ? tDetail("badges.commissionNotReady")
      : tDetail("badges.commissionAmount", { amount: formatNok(basis.commissionNok) });
  return { ordersBadge, commissionBadge };
}

export function buildBillingBasisDisplay(
  basis: ProviderBillingBasis,
  invoice: ProviderInvoiceSettings,
  tDetail: ProviderCustomerDetailTranslate,
): ProviderBillingBasisDisplay {
  const incomplete = basis.confidence === "incomplete";
  const incompleteLabel = tDetail("billingIncomplete");

  return {
    periodLabel: tDetail("billingPeriodLabel"),
    ordersLabel: String(basis.ordersThisMonth),
    revenueExVatLabel:
      basis.confidence === "complete" && basis.revenueExVatNok != null
        ? formatNok(basis.revenueExVatNok)
        : incomplete
          ? incompleteLabel
          : tDetail("vatNotSpecified"),
    vatLabel:
      basis.confidence === "complete" && basis.vatNok != null
        ? formatNok(basis.vatNok)
        : incomplete
          ? incompleteLabel
          : tDetail("vatNotSpecified"),
    revenueIncVatLabel:
      basis.confidence !== "incomplete" && basis.revenueIncVatNok > 0
        ? formatNok(basis.revenueIncVatNok)
        : incompleteLabel,
    commissionBaseLabel:
      basis.confidence === "incomplete" ? incompleteLabel : basis.commissionBaseLabel,
    commissionAmountLabel:
      basis.confidence === "incomplete" ? incompleteLabel : formatNok(basis.commissionNok),
    commissionRateLabel: tDetail("labels.commissionRateValue"),
    methodLabel: invoice.methodLabel,
    recipientLabel: invoice.recipientLabel,
    statusLabel: buildBillingBasisStatusLabel(basis, invoice, tDetail),
    confidence: basis.confidence,
    note:
      basis.confidence === "gross_only"
        ? tDetail("grossOnlyNote")
        : basis.confidence === "complete"
          ? tDetail("completeCommissionNote")
          : null,
  };
}
