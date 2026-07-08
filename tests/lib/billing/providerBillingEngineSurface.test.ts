import { describe, expect, it } from "vitest";

import {
  buildBillingProfileSurface,
  buildPaymentMethodSurface,
  buildProviderCommissionInvoiceSurface,
} from "@/lib/billing/providerBillingEngineSurface";

describe("providerBillingEngineSurface", () => {
  it("presents commission and recipient metadata without legal/tax fallback guessing", () => {
    const surface = buildBillingProfileSurface({
      billingStatus: "active",
      billingEmailCurrent: " Faktura@Provider.No ",
      adminEmails: ["Admin@Provider.No"],
      billingCurrency: "eur",
      billingTimezone: "Europe/Brussels",
      commissionRateBps: 500,
    });

    expect(surface.billingStatus).toBe("active");
    expect(surface.billingEmail).toBe("faktura@provider.no");
    expect(surface.adminEmails).toEqual(["admin@provider.no"]);
    expect(surface.billingCurrency).toBe("EUR");
    expect(surface.billingTimezone).toBe("Europe/Brussels");
    expect(surface.commissionRateLabel).toBe("5 %");
    expect(surface.commissionBasisLabel).toBe("Net lunch sales ex tax");
  });

  it("shows only safe card metadata", () => {
    expect(
      buildPaymentMethodSurface({
        brand: "visa",
        last4: "4242",
        expMonth: 1,
        expYear: 2031,
        status: "active",
      }),
    ).toEqual({
      hasPaymentMethod: true,
      label: "Visa ending in 4242 · 01/2031",
      status: "active",
    });

    expect(buildPaymentMethodSurface(null)).toEqual({
      hasPaymentMethod: false,
      label: "No card saved",
      status: "missing",
    });
  });

  it("formats provider commission invoice totals from integer minor units", () => {
    expect(
      buildProviderCommissionInvoiceSurface({
        totalAmountMinor: 123_45,
        currency: "CHF",
        paymentStatus: "pending",
        issuedAt: "2026-07-01T00:00:00Z",
        sentToEmailsSnapshot: ["billing@example.ch", "admin@example.ch"],
      }),
    ).toEqual({
      totalLabel: "123.45 CHF",
      paymentStatus: "pending",
      issuedAt: "2026-07-01T00:00:00Z",
      sentToEmails: ["billing@example.ch", "admin@example.ch"],
    });
  });

  it("fails closed when billing currency or timezone is missing", () => {
    const surface = buildBillingProfileSurface({});
    const invoice = buildProviderCommissionInvoiceSurface({ totalAmountMinor: 0 });

    expect(surface.billingCurrency).toBe("UNKNOWN");
    expect(surface.billingTimezone).toBe("unknown");
    expect(invoice.totalLabel).toBe("0.00 UNKNOWN");
  });
});
