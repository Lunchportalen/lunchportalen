import { describe, expect, it } from "vitest";

import {
  computeBillingBasis,
  sumOrderRevenueCents,
} from "@/lib/providers/providerCustomerBilling";
import { buildBillingBasisDisplay } from "@/lib/providers/providerCustomerDetailSurface";
import { loadDetailTranslators } from "./providerCustomerI18nTestHelpers";
import { formatProviderCustomerCount } from "@/lib/providers/providerCustomersSurface";
import {
  PROVIDER_LOCALE_READINESS,
  providerLocaleHasCompanyStorage,
  providerLocaleStorableScopes,
} from "@/lib/providers/providerLocaleReadiness";

describe("providerCustomerCounts display", () => {
  it("viser — ved null count", () => {
    expect(formatProviderCustomerCount(null)).toBe("—");
    expect(formatProviderCustomerCount(undefined)).toBe("—");
  });

  it("viser heltall ved gyldig count", () => {
    expect(formatProviderCustomerCount(2)).toBe("2");
  });
});

describe("billing basis VAT labels", () => {
  it("bruker complete når eks/mva/inkl finnes", () => {
    const basis = computeBillingBasis({
      ordersThisMonth: 1,
      revenueExVatNok: 82.8,
      vatNok: 20.7,
      revenueIncVatNok: 103.5,
    });
    expect(basis.confidence).toBe("complete");
    expect(basis.commissionBaseKey).toBe("taxEx");
    expect(basis.commissionNok).toBeCloseTo(4.14, 2);
  });

  it("bruker gross_only når bare inkl. mva finnes", async () => {
    const { tDetail, tBilling } = await loadDetailTranslators("nb");
    const totals = sumOrderRevenueCents([{ gross_cents_inc_vat: 10350 }]);
    const basis = computeBillingBasis({
      ordersThisMonth: 1,
      revenueIncVatNok: totals.revenueIncVatNok,
    });
    expect(basis.confidence).toBe("gross_only");
    expect(basis.commissionBaseKey).toBe("taxInc");
    expect(basis.commissionNok).toBeCloseTo(5.18, 2);

    const display = buildBillingBasisDisplay(
      basis,
      {
        method: "EHF",
        methodKey: "ehf",
        invoiceEmail: null,
        orgnr: "928038777",
        ehfEndpoint: "0192:928038777",
        ehfEnabled: true,
        billingContact: { name: null, email: null, phone: null },
        recipientValue: "0192:928038777",
        methodLabel: "EHF",
        recipientLabel: "0192:928038777",
      },
      tDetail,
      tBilling,
    );
    expect(display.revenueIncVatLabel).toContain("103");
    expect(display.revenueExVatLabel).toBe("Ikke spesifisert");
    expect(display.vatLabel).toBe("Ikke spesifisert");
    expect(display.commissionBaseLabel).toBe("inkl. mva");
    expect(display.note).toContain("inkl. mva");
  });

  it("merker ikke gross som eks. mva", async () => {
    const { tDetail, tBilling } = await loadDetailTranslators("nb");
    const basis = computeBillingBasis({ ordersThisMonth: 0, revenueIncVatNok: 0 });
    const display = buildBillingBasisDisplay(
      basis,
      {
        method: null,
        methodKey: "notSelected",
        invoiceEmail: null,
        orgnr: null,
        ehfEndpoint: null,
        ehfEnabled: false,
        billingContact: { name: null, email: null, phone: null },
        recipientValue: null,
        methodLabel: "Ikke valgt",
        recipientLabel: "Ikke valgt",
      },
      tDetail,
      tBilling,
    );
    expect(display.revenueExVatLabel).toBe("Fakturagrunnlag ikke komplett");
    expect(display.confidence).toBe("incomplete");
  });
});

describe("provider locale readiness audit", () => {
  it("dokumenterer provider_settings.locale og profiles.preferred_locale som storable scopes", () => {
    const storable = providerLocaleStorableScopes();
    expect(storable).toHaveLength(2);
    expect(storable.map((row) => row.proposedField)).toEqual(
      expect.arrayContaining(["provider_settings.locale", "profiles.preferred_locale"]),
    );
    expect(providerLocaleHasCompanyStorage()).toBe(false);
    expect(PROVIDER_LOCALE_READINESS.some((r) => r.scope === "Customer/company")).toBe(true);
  });
});
