import { describe, expect, it, beforeEach } from "vitest";
import {
  resolveUsAddressJurisdiction,
  US_BOUNDARY_CASES,
} from "@/lib/tax/jurisdictions/usAddressResolver";
import {
  assertCanadaComponentsComplete,
  previewCanadaTaxComponents,
} from "@/lib/tax/jurisdictions/canadaTaxComponents";
import {
  assertAllInvoicePacksPresent,
  assertInvoiceIssuanceAllowed,
  buildCreditNoteDraft,
  COUNTRY_INVOICE_PACKS,
} from "@/lib/invoice/countryInvoicePacks";
import {
  deliverEInvoiceStagingMock,
  resetEInvoiceMockStateForTests,
  credentialDependencies,
} from "@/lib/invoice/eInvoiceAdapters";
import {
  assertNoRawI18nKeys,
  recordAcceptance,
  requiresReconsent,
} from "@/lib/legal/legalAcceptance";
import { buildLegalDocumentMatrix } from "@/lib/legal/legalDocumentRegistry";
import { buildCommissionSnapshot, assertCommissionExactFivePercent } from "@/lib/billing/commissionTaxSnapshot";
import { evaluateTechnical21Complete } from "@/lib/markets/technicalCompletionGate";
import { allResearchedTaxRules } from "@/lib/tax/rules/researchedCountryRules";
import { SUPPORTED_COUNTRY_CODES, MARKET_LOCALE_CODES, SUPPORTED_LANGUAGES } from "@/lib/markets/supportedMarkets";

describe("Phase 15G.2 US address resolver", () => {
  it("covers boundary fixtures fail-closed", () => {
    for (const c of US_BOUNDARY_CASES) {
      const r = resolveUsAddressJurisdiction(c.input);
      expect(r.ok).toBe(c.expectOk);
      if (r.ok === false && c.expectCode) expect(r.code).toBe(c.expectCode);
    }
  });
});

describe("Phase 15G.2 Canada components", () => {
  it("has researched components for all 13 and forbids billing", () => {
    assertCanadaComponentsComplete();
    const preview = previewCanadaTaxComponents({
      provinceCode: "ON",
      taxableBaseMinor: BigInt(10_000),
      allowBilling: false,
    });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.components[0]?.code).toBe("HST");
      expect(preview.previewTaxMinor).toBe(BigInt(1300));
      expect(preview.warning).toBe("NOT_APPROVED_FAIL_CLOSED_FOR_BILLING");
    }
    const blocked = previewCanadaTaxComponents({
      provinceCode: "ON",
      taxableBaseMinor: BigInt(10_000),
      allowBilling: true,
    });
    expect(blocked.ok).toBe(false);
  });

  it("sums GST+QST for QC in preview", () => {
    const preview = previewCanadaTaxComponents({
      provinceCode: "QC",
      taxableBaseMinor: BigInt(10_000),
      allowBilling: false,
    });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.components.map((c) => c.code).sort()).toEqual(["GST", "QST"]);
      // 5% + 9.975% = 1497.5 → half-up components separately: 500 + 998 = 1498
      expect(preview.previewTaxMinor).toBe(BigInt(500) + BigInt(998));
    }
  });
});

describe("Phase 15G.2 invoice / e-invoice / legal / commission", () => {
  beforeEach(() => resetEInvoiceMockStateForTests());

  it("has 21 invoice packs and refuses issuance / cross-currency credit", () => {
    assertAllInvoicePacksPresent();
    expect(Object.keys(COUNTRY_INVOICE_PACKS)).toHaveLength(21);
    expect(() => assertInvoiceIssuanceAllowed("NO")).toThrow(/INVOICE_NOT_APPROVED/);
    expect(() =>
      buildCreditNoteDraft({
        countryCode: "NO",
        originalInvoiceId: "inv-1",
        currencyCode: "EUR",
        amountMinor: BigInt(100),
        taxAmountMinor: BigInt(25),
        reason: "test",
      }),
    ).toThrow(/CROSS_CURRENCY/);
    const cn = buildCreditNoteDraft({
      countryCode: "NO",
      originalInvoiceId: "inv-1",
      currencyCode: "NOK",
      amountMinor: BigInt(100),
      taxAmountMinor: BigInt(15),
      reason: "cancel",
    });
    expect(cn.originalInvoiceId).toBe("inv-1");
  });

  it("mock e-invoice never claims live registration; peppol needs credentials", () => {
    const pdf = deliverEInvoiceStagingMock({
      countryCode: "NO",
      invoiceId: "i1",
      idempotencyKey: "k1",
      channel: "pdf_email",
      payloadHash: "abc",
    });
    expect(pdf.ok).toBe(true);
    if (pdf.ok) {
      expect(pdf.isMock).toBe(true);
      expect(pdf.liveRegistrationClaimed).toBe(false);
    }
    const peppol = deliverEInvoiceStagingMock({
      countryCode: "NO",
      invoiceId: "i2",
      idempotencyKey: "k2",
      channel: "peppol",
      payloadHash: "abc",
    });
    expect(peppol.ok).toBe(false);
    expect(peppol.ok === false && peppol.code === "CREDENTIAL_REQUIRED").toBe(true);
    expect(credentialDependencies().length).toBeGreaterThan(0);
  });

  it("legal acceptance + reconsent without raw i18n keys", () => {
    const docs = buildLegalDocumentMatrix();
    expect(docs.length).toBe(MARKET_LOCALE_CODES.length * 15);
    const doc = docs.find((d) => d.locale === "nb-NO" && d.documentType === "privacy_notice")!;
    assertNoRawI18nKeys(doc.bodyStub);
    const acc = recordAcceptance({
      id: "a1",
      subjectType: "employee",
      subjectId: "u1",
      doc,
      acceptedAt: "2026-07-16T10:00:00.000Z",
      method: "clickwrap",
    });
    expect(requiresReconsent(acc, { version: "0.3.0", checksum: "changed" })).toBe(true);
    expect(requiresReconsent(acc, { version: doc.version, checksum: doc.checksum })).toBe(false);
  });

  it("commission snapshot is 5% and tax fail-closed until APPROVED", () => {
    const orderNet = BigInt(20_000);
    const snap = buildCommissionSnapshot({
      countryCode: "NO",
      currencyCode: "NOK",
      orderNetMinor: orderNet,
      taxPointDate: "2026-07-16",
      rules: allResearchedTaxRules(),
      capturedAt: "2026-07-16T10:00:00.000Z",
    });
    expect(snap.commissionBps).toBe(500);
    expect(snap.commissionMinor).toBe(BigInt(1000));
    expect(snap.commissionTax.status).toBe("FAIL_CLOSED");
    assertCommissionExactFivePercent(orderNet, snap.commissionMinor);
  });
});

describe("Phase 15G.2 technical completion gate (honest)", () => {
  it("reports NO-GO until CI/staging/US/CA footprint green", () => {
    expect(SUPPORTED_COUNTRY_CODES).toHaveLength(21);
    expect(MARKET_LOCALE_CODES).toHaveLength(24);
    expect(SUPPORTED_LANGUAGES).toHaveLength(15);
    const report = evaluateTechnical21Complete({
      fullCiGreen: false,
      stagingCountriesPassed: 0,
      stagingLocalesPassed: 0,
      unresolvedP0P1: 0,
      rollbackCertified: false,
    });
    expect(report.technical21Complete).toBe(false);
    expect(report.decision).toBe("NO-GO");
    expect(report.coverage.usBlocked).toBe(51);
    expect(report.coverage.caBlocked).toBe(13);
  });
});
