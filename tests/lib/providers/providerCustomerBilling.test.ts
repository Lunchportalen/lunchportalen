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
  buildBillingBasisBadges,
  buildBillingBasisStatusLabel,
  buildCustomerIdentityDisplay,
} from "@/lib/providers/providerCustomerDetailSurface";
import { loadDetailTranslators, loadProviderCustomerMessages } from "./providerCustomerI18nTestHelpers";

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
  it("viser org.nr ikke registrert når mangler", async () => {
    const translators = await loadDetailTranslators("nb");
    const identity = buildCustomerIdentityDisplay(
      {
        companyName: "Pettersen&Co",
        orgnr: null,
        status: "ACTIVE",
      },
      translators,
    );
    expect(identity.orgnrLabel).toBe("Org.nr ikke registrert");
    expect(identity.companyName).toBe("Pettersen&Co");
  });

  it("viser fakturagrunnlag ikke komplett uten ordregrunnlag", async () => {
    const { tDetail } = await loadDetailTranslators("nb");
    const display = buildBillingBasisDisplay(
      computeBillingBasis({ ordersThisMonth: 0, revenueIncVatNok: 0 }),
      buildProviderInvoiceSettings({ ehfEnabled: true, ehfEndpoint: "0192:928038777", orgnr: "928038777" }),
      tDetail,
    );
    expect(display.confidence).toBe("incomplete");
    expect(display.revenueIncVatLabel).toBe("Fakturagrunnlag ikke komplett");
    expect(display.statusLabel).toBe("Mangler ordregrunnlag");
    expect(display.periodLabel).toBe("Siste 30 dager");
  });

  it("viser klar status og complete-note når mva-splitt finnes", async () => {
    const { tDetail } = await loadDetailTranslators("nb");
    const basis = computeBillingBasis({
      ordersThisMonth: 2,
      revenueExVatNok: 200,
      vatNok: 50,
      revenueIncVatNok: 250,
    });
    const invoice = buildProviderInvoiceSettings({ billingEmail: "faktura@test.no" });
    const display = buildBillingBasisDisplay(basis, invoice, tDetail);
    expect(display.statusLabel).toBe("Klar til fakturagrunnlag");
    expect(display.note).toBe("Provisjon beregnes av omsetning eks. mva.");
    expect(buildBillingBasisBadges(basis, tDetail).ordersBadge).toBe("2 ordre denne måneden");
  });

  it("viser gross-only forklaring kun når confidence er gross_only", async () => {
    const { tDetail } = await loadDetailTranslators("nb");
    const basis = computeBillingBasis({ ordersThisMonth: 1, revenueIncVatNok: 103.5 });
    const display = buildBillingBasisDisplay(basis, buildProviderInvoiceSettings({}), tDetail);
    expect(display.note).toContain("inkl. mva");
    expect(buildBillingBasisStatusLabel(basis, buildProviderInvoiceSettings({}), tDetail)).toBe(
      "Mangler fakturamottaker",
    );
  });
});

describe("agreement surface labels", () => {
  it("bruker Leveringsadresse via i18n", async () => {
    const messages = await loadProviderCustomerMessages("nb");
    const ns = messages.provider.customers.agreement as {
      labels: { location: string };
      locationMissing: string;
    };
    expect(ns.labels.location).toBe("Leveringsadresse");
    expect(ns.locationMissing).toBe("Leveringsadresse ikke satt");
  });
});
