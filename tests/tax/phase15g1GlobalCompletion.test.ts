import { describe, expect, it } from "vitest";
import { resolveTax } from "@/lib/tax/engine/resolver";
import {
  assertNoForgedTaxApprovals,
  allResearchedTaxRules,
  countResearchedRules,
  RESEARCHED_TAX_RULES_BY_COUNTRY,
} from "@/lib/tax/rules/researchedCountryRules";
import {
  assertUsJurisdictionLaunchable,
  countUsJurisdictionCoverage,
  resolveUsJurisdiction,
  US_STATE_JURISDICTIONS,
} from "@/lib/tax/jurisdictions/usStates";
import {
  assertCanadaJurisdictionLaunchable,
  countCanadaJurisdictionCoverage,
  CANADA_PROVINCE_JURISDICTIONS,
} from "@/lib/tax/jurisdictions/canadaProvinces";
import {
  blockUnsupportedSource,
  detectChecksumDrift,
  detectDuplicateSources,
  expireApprovalsOnEvidenceChange,
  ingestOfficialSource,
  isEvidenceStale,
} from "@/lib/tax/sources/sourceEvidencePipeline";
import { assertOfficialSourceUrl } from "@/lib/tax/sources/allowedOfficialDomains";
import {
  applyReviewDecision,
  countryActivationBlockedReasons,
} from "@/lib/review/reviewWorkflow";
import { countMarketplaceApprovals, assertMarketplaceApprovedForCutover } from "@/lib/markets/marketplaceLegalModel";
import {
  assertNoFakeLegalInvoiceIssuance,
  countEInvoiceApprovals,
  E_INVOICE_CAPABILITIES,
} from "@/lib/invoice/eInvoiceRegistry";
import {
  assertNoForgedLegalApprovals,
  buildLegalDocumentMatrix,
  countLegalDocumentApprovals,
} from "@/lib/legal/legalDocumentRegistry";
import { evaluateGlobal21Ready } from "@/lib/markets/globalActivationGate";
import { buildFailClosedOrderSnapshot } from "@/lib/integrations/globalComplianceSnapshots";
import { SUPPORTED_COUNTRY_CODES, MARKET_LOCALE_CODES } from "@/lib/markets/supportedMarkets";
import { countTaxPacksByStatus } from "@/lib/tax/packs/countryTaxPacks";

describe("Phase 15G.1 source evidence pipeline", () => {
  it("ingests official Skatteetaten source and blocks Wikipedia", () => {
    const src = ingestOfficialSource({
      id: "s1",
      countryCode: "NO",
      authorityName: "Skatteetaten",
      sourceUrl: "https://www.skatteetaten.no/satser/merverdiavgift/",
      sourceTitle: "Merverdiavgift",
      retrievedAt: "2026-07-16T09:00:00.000Z",
      language: "nb",
      sourceType: "tax_rate_table",
      bodyOrCanonicalText: "Alminnelig sats 25% Næringsmidler 15%",
      extractedClaims: ["standard_25", "food_15"],
    });
    expect(src.checksum.length).toBe(64);
    expect(src.reviewerStatus).toBe("UNREVIEWED");
    expect(blockUnsupportedSource("https://en.wikipedia.org/wiki/VAT").ok).toBe(false);
    expect(() => assertOfficialSourceUrl("https://www.investopedia.com/vat")).toThrow(/UNSUPPORTED_SOURCE/);
  });

  it("detects duplicates, drift, stale evidence, and approval expiry", () => {
    const a = ingestOfficialSource({
      id: "a",
      countryCode: "GB",
      authorityName: "HMRC",
      sourceUrl: "https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091",
      sourceTitle: "709/1",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      language: "en",
      sourceType: "tax_guidance",
      bodyOrCanonicalText: "hot takeaway standard-rated",
      extractedClaims: ["hot_standard"],
    });
    const b = { ...a, id: "b" };
    expect(detectDuplicateSources([a, b])).toHaveLength(1);
    const drift = detectChecksumDrift(a, "changed body");
    expect(drift.drifted).toBe(true);
    expect(isEvidenceStale(a, "2026-07-16T00:00:00.000Z", 30)).toBe(true);
    const expired = expireApprovalsOnEvidenceChange(a.checksum, drift.nextChecksum, [
      { id: "rule-1", status: "APPROVED" },
      { id: "rule-2", status: "RESEARCHED" },
    ]);
    expect(expired).toEqual([{ id: "rule-1", status: "EXPIRED", reason: "EVIDENCE_CHECKSUM_CHANGED" }]);
  });
});

describe("Phase 15G.1 researched tax rules — never APPROVED", () => {
  it("has researched rules and zero forged approvals", () => {
    assertNoForgedTaxApprovals();
    const c = countResearchedRules();
    expect(c.approved).toBe(0);
    expect(c.researched).toBeGreaterThan(0);
    expect(RESEARCHED_TAX_RULES_BY_COUNTRY.NO.length).toBeGreaterThanOrEqual(3);
    expect(RESEARCHED_TAX_RULES_BY_COUNTRY.GB.length).toBeGreaterThanOrEqual(3);
    expect(RESEARCHED_TAX_RULES_BY_COUNTRY.US).toHaveLength(0);
  });

  it("fail-closes researched NO food rule until APPROVED", () => {
    const rules = allResearchedTaxRules().filter((r) => r.countryCode === "NO");
    const r = resolveTax({
      countryCode: "NO",
      currencyCode: "NOK",
      taxCategory: "cold_food",
      customerType: "B2B",
      fulfillmentType: "delivery",
      taxableBaseMinor: BigInt(10_000),
      taxPointDate: "2026-07-16",
      rules,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.code === "TAX_RULE_NOT_APPROVED").toBe(true);
  });
});

describe("Phase 15G.1 USA + Canada jurisdiction coverage", () => {
  it("classifies 51 US jurisdictions as blocked until DOR evidence approval", () => {
    expect(US_STATE_JURISDICTIONS).toHaveLength(51);
    const cov = countUsJurisdictionCoverage();
    expect(cov.total).toBe(51);
    expect(cov.supported).toBe(0);
    expect(cov.blocked).toBe(51);
    expect(resolveUsJurisdiction("ny")?.name).toBe("New York");
    expect(() => assertUsJurisdictionLaunchable("TX")).toThrow(/US_JURISDICTION_BLOCKED/);
  });

  it("classifies 13 CA provinces/territories with researched GST/HST models", () => {
    expect(CANADA_PROVINCE_JURISDICTIONS).toHaveLength(13);
    const cov = countCanadaJurisdictionCoverage();
    expect(cov.classified).toBe(13);
    expect(cov.supported).toBe(0);
    expect(cov.blocked).toBe(13);
    const ns = CANADA_PROVINCE_JURISDICTIONS.find((p) => p.code === "NS");
    expect(ns?.gstOrHstBpsResearched).toBe(1400);
    expect(ns?.taxModel).toBe("HST");
    expect(() => assertCanadaJurisdictionLaunchable("ON")).toThrow(/CA_JURISDICTION_BLOCKED/);
  });
});

describe("Phase 15G.1 marketplace / invoice / legal / review", () => {
  it("keeps marketplace models DRAFT and blocks cutover", () => {
    expect(countMarketplaceApprovals().APPROVED).toBe(0);
    expect(countMarketplaceApprovals().DRAFT).toBe(21);
    expect(() => assertMarketplaceApprovedForCutover("NO")).toThrow(/MARKETPLACE_MODEL_NOT_APPROVED/);
  });

  it("keeps e-invoice stubs from issuing fake legal invoices", () => {
    expect(E_INVOICE_CAPABILITIES.US.requirementStatus).toBe("NOT_APPLICABLE");
    expect(countEInvoiceApprovals().approvedOrNa).toBe(1); // US only N/A
    expect(() => assertNoFakeLegalInvoiceIssuance("NO")).toThrow(/FAKE_LEGAL_INVOICE_FORBIDDEN/);
  });

  it("builds 24-locale legal document stubs without forged LEGAL_APPROVED", () => {
    const docs = buildLegalDocumentMatrix();
    assertNoForgedLegalApprovals(docs);
    const counts = countLegalDocumentApprovals(docs);
    expect(counts.localesTotal).toBe(24);
    expect(counts.legalApproved).toBe(0);
    expect(counts.privacyApproved).toBe(0);
    expect(MARKET_LOCALE_CODES).toHaveLength(24);
    expect(docs.length).toBeGreaterThan(24 * 8);
  });

  it("enforces no self-approval and expiry on checksum drift", () => {
    expect(() =>
      applyReviewDecision({
        item: {
          id: "q1",
          domain: "tax",
          countryCode: "NO",
          locale: null,
          subjectId: "rule-1",
          evidenceChecksum: "abc",
          status: "QUEUED",
          createdAt: "2026-07-16T00:00:00.000Z",
        },
        identity: {
          reviewerId: "same",
          role: "tax_reviewer",
          subjectAuthorId: "same",
        },
        decision: "APPROVE",
        evidenceChecksumNow: "abc",
        decidedAt: "2026-07-16T01:00:00.000Z",
        notes: "no",
        historyId: "h1",
      }),
    ).toThrow(/SELF_APPROVAL_FORBIDDEN/);

    const drifted = applyReviewDecision({
      item: {
        id: "q2",
        domain: "tax",
        countryCode: "NO",
        locale: null,
        subjectId: "rule-1",
        evidenceChecksum: "abc",
        status: "QUEUED",
        createdAt: "2026-07-16T00:00:00.000Z",
      },
      identity: {
        reviewerId: "reviewer-1",
        role: "tax_reviewer",
        subjectAuthorId: "author-1",
      },
      decision: "APPROVE",
      evidenceChecksumNow: "changed",
      decidedAt: "2026-07-16T01:00:00.000Z",
      notes: "stale",
      historyId: "h2",
    });
    expect(drifted.item.status).toBe("EXPIRED");
  });

  it("blocks country activation without all approvals", () => {
    const reasons = countryActivationBlockedReasons({
      taxApproved: false,
      legalApproved: false,
      invoiceApproved: false,
      eInvoiceApprovedOrNa: false,
      privacyApproved: false,
      marketplaceApproved: false,
      nativeLocalesApproved: false,
    });
    expect(reasons.length).toBeGreaterThanOrEqual(6);
  });
});

describe("Phase 15G.1 GLOBAL_21_READY honest gate", () => {
  it("reports BUILT_BUT_NOT_LEGALLY_APPROVED with zero human approvals", () => {
    expect(SUPPORTED_COUNTRY_CODES).toHaveLength(21);
    expect(countTaxPacksByStatus().APPROVED).toBe(0);
    const report = evaluateGlobal21Ready({ stagingGoldenPathPass: 0 });
    expect(report.global21Ready).toBe(false);
    expect(report.decision).toBe("BUILT_BUT_NOT_LEGALLY_APPROVED");
    expect(report.taxApproved).toBe(0);
    expect(report.usSupported).toBe(0);
    expect(report.caSupported).toBe(0);
    expect(report.forgedTaxApprovals).toBe(0);
    expect(report.blockers.some((b) => b.startsWith("TAX_APPROVED"))).toBe(true);
  });

  it("builds fail-closed order compliance snapshots", () => {
    const snap = buildFailClosedOrderSnapshot({
      countryCode: "US",
      currencyCode: "USD",
      locale: "en-US",
      jurisdictionPath: "US/TX",
      failCode: "SUBDIVISION_UNSUPPORTED",
      engineVersion: "15g.1.0",
      capturedAt: "2026-07-16T09:00:00.000Z",
    });
    expect(snap.tax.resolveStatus).toBe("FAIL_CLOSED");
    expect(snap.commissionBps).toBe(500);
  });
});
