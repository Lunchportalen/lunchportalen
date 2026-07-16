import { describe, expect, it } from "vitest";
import { TestFixtureProvider, countCanadaFixtureCoverage, countUsFixtureCoverage } from "@/lib/tax/providers/testFixtureProvider";
import { US_STATE_JURISDICTIONS } from "@/lib/tax/jurisdictions/usStates";
import { CANADA_PROVINCE_JURISDICTIONS } from "@/lib/tax/jurisdictions/canadaProvinces";
import {
  allTechnicallyConfiguredRules,
  countTechnicalTaxConfiguration,
} from "@/lib/tax/rules/technicallyConfiguredRules";
import { runAllCountryInvoiceDryRuns, runInvoiceDryRun } from "@/lib/billing/globalInvoiceFlow";
import { evaluateTechnical21Complete } from "@/lib/markets/technicalCompletionGate";
import {
  assertNotForgedApproval,
  assertTechnicalTransition,
  activationBlockedReasons,
} from "@/lib/markets/complianceStatus";
import { MARKET_LOCALE_CODES, SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { buildLegalDocumentMatrix } from "@/lib/legal/legalDocumentRegistry";
import { resolveTax } from "@/lib/tax/engine/resolver";

describe("Phase 15G.2B status separation", () => {
  it("allows technical transitions and forbids forged approval labels in technical lane", () => {
    assertTechnicalTransition("TECHNICALLY_CONFIGURED", "TECHNICALLY_TESTED");
    expect(() => assertNotForgedApproval("TAX_APPROVED")).toThrow(/FORGED_APPROVAL/);
    const reasons = activationBlockedReasons({
      technical21Complete: true,
      taxApprovedCount: 0,
      legalApprovedCount: 0,
      invoiceApprovedCount: 0,
      eInvoiceApprovedOrNa: 1,
      privacyApprovedCount: 0,
      localizationApprovedCount: 0,
    });
    expect(reasons.some((r) => r.startsWith("TAX_APPROVED"))).toBe(true);
  });
});

describe("Phase 15G.2B US/CA fixture provider", () => {
  const provider = new TestFixtureProvider();

  it("covers 51 US resolver paths as supported or N/A", () => {
    const cov = countUsFixtureCoverage();
    expect(cov.paths).toBe(51);
    expect(cov.technicallySupported + cov.notApplicable).toBe(51);
    expect(cov.blocked).toBe(0);
    for (const s of US_STATE_JURISDICTIONS) {
      const addr = provider.resolveAddress(
        { countryCode: "US", subdivisionCode: s.stateCode },
        "2026-07-16T12:00:00.000Z",
      );
      expect(addr.ok).toBe(true);
      if (addr.ok) {
        expect(["TECHNICALLY_SUPPORTED", "NOT_APPLICABLE"]).toContain(addr.technicalStatus);
        const rates = provider.resolveRates({
          jurisdictionPath: addr.jurisdictionPath,
          category: "prepared_food",
          requestedAt: "2026-07-16T12:00:00.000Z",
        });
        expect(rates.ok).toBe(true);
      }
    }
  });

  it("covers 13 Canada resolver paths with component rates", () => {
    const cov = countCanadaFixtureCoverage();
    expect(cov.paths).toBe(13);
    expect(cov.technicallySupported).toBe(13);
    for (const p of CANADA_PROVINCE_JURISDICTIONS) {
      const addr = provider.resolveAddress(
        { countryCode: "CA", subdivisionCode: p.code },
        "2026-07-16T12:00:00.000Z",
      );
      expect(addr.ok).toBe(true);
      if (!addr.ok) continue;
      const rates = provider.resolveRates({
        jurisdictionPath: addr.jurisdictionPath,
        category: "prepared_food",
        requestedAt: "2026-07-16T12:00:00.000Z",
      });
      expect(rates.ok).toBe(true);
      if (rates.ok && p.code === "QC") {
        expect(rates.rateLines.some((l) => l.taxName === "QST")).toBe(true);
      }
    }
  });

  it("fail-closes unknown subdivision and never uses national US flat path", () => {
    const unknown = provider.resolveAddress(
      { countryCode: "US", subdivisionCode: "XX" },
      "2026-07-16T12:00:00.000Z",
    );
    expect(unknown.ok).toBe(false);
    const noSub = provider.resolveAddress({ countryCode: "US" }, "2026-07-16T12:00:00.000Z");
    expect(noSub.ok).toBe(false);
  });
});

describe("Phase 15G.2B tax configuration + billing dry-run", () => {
  it("configures 19 VAT countries × categories and keeps approvals at 0", () => {
    const c = countTechnicalTaxConfiguration();
    expect(c.countriesWithRules).toBe(21);
    expect(c.approved).toBe(0);
    expect(c.ruleCount).toBe(19 * 17);
    const r = resolveTax({
      countryCode: "DE",
      currencyCode: "EUR",
      taxCategory: "cold_food",
      customerType: "B2C",
      fulfillmentType: "takeaway",
      taxableBaseMinor: BigInt(10_000),
      taxPointDate: "2026-07-16",
      rules: allTechnicallyConfiguredRules(),
    });
    expect(r.ok).toBe(false); // RESEARCHED ≠ APPROVED
  });

  it("runs 21-country invoice dry-run with zero Stripe calls", () => {
    const all = runAllCountryInvoiceDryRuns("2026-07-16T12:00:00.000Z");
    expect(all.passed).toBe(21);
    expect(all.failed).toBe(0);
    expect(all.stripeCalls).toBe(0);
    const us = runInvoiceDryRun({
      countryCode: "US",
      subdivisionCode: "OR",
      netMinor: BigInt(10_000),
      taxPointDate: "2026-07-16",
      capturedAt: "2026-07-16T12:00:00.000Z",
    });
    expect(us.ok).toBe(true);
    expect(us.legalIssuance).toBe(false);
    expect(us.taxResolveStatus).toBe("PROVIDER_FIXTURE");
  });
});

describe("Phase 15G.2B TECHNICAL_21_COMPLETE gate", () => {
  it("becomes AWAITING_EXTERNAL_APPROVAL when CI/staging/rollback flags are green", () => {
    expect(SUPPORTED_COUNTRY_CODES).toHaveLength(21);
    expect(MARKET_LOCALE_CODES).toHaveLength(24);
    expect(buildLegalDocumentMatrix().length).toBe(24 * 15);
    const report = evaluateTechnical21Complete({
      fullCiGreen: true,
      stagingCountriesPassed: 21,
      stagingLocalesPassed: 24,
      unresolvedP0P1: 0,
      rollbackCertified: true,
    });
    expect(report.coverage.usSupportedOrNa).toBe(51);
    expect(report.coverage.caSupportedOrNa).toBe(13);
    expect(report.technical21Complete).toBe(true);
    expect(report.global21Ready).toBe(false);
    expect(report.decision).toBe("AWAITING_EXTERNAL_APPROVAL");
  });

  it("stays NO-GO when staging not certified", () => {
    const report = evaluateTechnical21Complete({
      fullCiGreen: false,
      stagingCountriesPassed: 0,
      stagingLocalesPassed: 0,
      unresolvedP0P1: 0,
      rollbackCertified: false,
    });
    expect(report.decision).toBe("NO-GO");
  });
});
