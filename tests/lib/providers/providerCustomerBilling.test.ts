import { describe, expect, it } from "vitest";

import {
  LUNCHPORTALEN_COMMISSION_RATE,
  buildProviderInvoiceSettings,
  computeBillingBasis,
  formatDeliveryAddress,
  formatNok,
  invoiceMethodLabel,
  resolveCompanyOrgnr,
  resolveInvoiceMethod,
  suggestEhfEndpoint,
} from "@/lib/providers/providerCustomerBilling";
import {
  buildBillingBasisDisplay,
  buildCustomerIdentityDisplay,
} from "@/lib/providers/providerCustomerDetailSurface";
import { PROVIDER_AGREEMENT_COPY } from "@/lib/providers/providerCustomerAgreementSurface";

describe("providerCustomerBilling", () => {
  it("resolver orgnr fra orgnr eller organization_number", () => {
    expect(resolveCompanyOrgnr("928038777", null)).toBe("928038777");
    expect(resolveCompanyOrgnr(null, "928 038 777")).toBe("928038777");
    expect(resolveCompanyOrgnr(null, null)).toBeNull();
  });

  it("foreslår EHF-endepunkt 0192:{orgnr}", () => {
    expect(suggestEhfEndpoint("928038777")).toBe("0192:928038777");
    expect(suggestEhfEndpoint("invalid")).toBeNull();
  });

  it("deriverer fakturametode fra eksisterende companies-felter", () => {
    expect(resolveInvoiceMethod({ ehfEnabled: true, ehfEndpoint: "0192:928038777" })).toBe("EHF");
    expect(resolveInvoiceMethod({ billingEmail: "faktura@test.no" })).toBe("EMAIL");
    expect(resolveInvoiceMethod({})).toBeNull();
    expect(invoiceMethodLabel(null)).toBe("Ikke valgt");
    expect(invoiceMethodLabel("EHF")).toBe("EHF");
    expect(invoiceMethodLabel("EMAIL")).toBe("E-post");
  });

  it("bygger invoice settings read-model", () => {
    const settings = buildProviderInvoiceSettings({
      orgnr: "928038777",
      ehfEnabled: true,
      ehfEndpoint: "0192:928038777",
      contactName: "Thomas",
      contactEmail: "hei@pettersenco.no",
    });
    expect(settings.method).toBe("EHF");
    expect(settings.orgnr).toBe("928038777");
    expect(settings.recipientLabel).toBe("0192:928038777");
    expect(settings.billingContact.name).toBe("Thomas");
  });

  it("beregner 5 % provisjonsgrunnlag fra inkl. mva når bare gross finnes", () => {
    const basis = computeBillingBasis({ ordersThisMonth: 1, revenueIncVatNok: 103.5 });
    expect(basis.ordersThisMonth).toBe(1);
    expect(basis.revenueIncVatNok).toBe(103.5);
    expect(basis.commissionNok).toBeCloseTo(103.5 * LUNCHPORTALEN_COMMISSION_RATE, 2);
    expect(basis.commissionBaseLabel).toBe("inkl. mva");
    expect(basis.confidence).toBe("gross_only");
  });

  it("formaterer leveringsadresse med navn og adresse", () => {
    expect(
      formatDeliveryAddress({
        locationName: "Hovedlokasjon",
        locationAddress: "Sluppenvegen 25, 7037 Trondheim",
      }),
    ).toBe("Hovedlokasjon\nSluppenvegen 25, 7037 Trondheim");
    expect(formatDeliveryAddress({})).toBe("Leveringsadresse ikke satt");
  });

  it("formaterer NOK", () => {
    expect(formatNok(103.5)).toContain("103");
  });
});

describe("providerCustomerDetailSurface", () => {
  it("viser org.nr ikke registrert når mangler", () => {
    const identity = buildCustomerIdentityDisplay({
      companyName: "Pettersen&Co",
      orgnr: null,
      status: "ACTIVE",
    });
    expect(identity.orgnrLabel).toBe("Org.nr ikke registrert");
  });

  it("viser fakturagrunnlag ikke komplett uten ordregrunnlag", () => {
    const display = buildBillingBasisDisplay(
      computeBillingBasis({ ordersThisMonth: 0, revenueIncVatNok: 0 }),
      buildProviderInvoiceSettings({ ehfEnabled: true, ehfEndpoint: "0192:928038777", orgnr: "928038777" }),
    );
    expect(display.confidence).toBe("incomplete");
    expect(display.revenueIncVatLabel).toBe("Fakturagrunnlag ikke komplett");
  });
});

describe("agreement surface copy", () => {
  it("bruker Leveringsadresse, ikke Lokasjon", () => {
    expect(PROVIDER_AGREEMENT_COPY.labels.location).toBe("Leveringsadresse");
    expect(PROVIDER_AGREEMENT_COPY.locationMissing).toBe("Leveringsadresse ikke satt");
  });
});
