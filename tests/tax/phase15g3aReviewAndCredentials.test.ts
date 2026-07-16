/**
 * Phase 15G.3A — completeness, roster honesty, queues never APPROVED, ingestion rejects forged.
 */
import { describe, expect, it } from "vitest";
import {
  auditAllCountries,
  buildPhase15g3aReviewQueues,
  auditCountryCompleteness,
} from "@/lib/review/phase15g3aCompleteness";
import { assertNoFabricatedReviewers, countReviewerRoster } from "@/lib/review/reviewerRosterSlots";
import { auditAllCredentialChecklists } from "@/lib/review/credentialChecklist";
import { auditOfficialSourceClosure } from "@/lib/review/officialSourceInventory";
import {
  emptyApprovalCounts,
  validateApprovalIngestion,
} from "@/lib/review/approvalIngestionContract";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_MARKET_LOCALES } from "@/lib/i18n/localeRegistry";

describe("Phase 15G.3A review packs and credentials", () => {
  it("exports 21/21 completeness reports with packComplete=false", () => {
    const all = auditAllCountries();
    expect(all.countries).toHaveLength(21);
    expect(all.summary.complete).toBe(0);
    expect(all.summary.incomplete).toBe(21);
    expect(all.releaseSha).toBe("b88aaf99780e0a5d71404e831fd87eb90031fb6e");
    expect(all.summary.approvals.TAX_APPROVED).toBe(0);
    expect(all.summary.approvals.READY_FOR_GLOBAL_CUTOVER).toBe(0);
    expect(all.summary.approvals.E_INVOICE_APPROVED_OR_NOT_APPLICABLE).toBe(1);
  });

  it("every country has P0 gaps and REVIEWER_REQUIRED", () => {
    for (const cc of SUPPORTED_COUNTRY_CODES) {
      const r = auditCountryCompleteness(cc);
      expect(r.reviewerStatus).toBe("REVIEWER_REQUIRED");
      expect(r.packComplete).toBe(false);
      expect(r.missingMandatoryFields.some((g) => g.severity === "P0")).toBe(true);
      expect(r.approvals.tax).toBe("NONE");
    }
  });

  it("never fabricates reviewers; all slots REVIEWER_REQUIRED", () => {
    expect(() => assertNoFabricatedReviewers()).not.toThrow();
    const roster = countReviewerRoster();
    expect(roster.assigned).toBe(0);
    expect(roster.taxSlotsRequired).toBe(21);
    expect(roster.legalSlotsRequired).toBe(21);
    expect(roster.nativeSlotsRequired).toBe(SUPPORTED_MARKET_LOCALES.length);
    expect(roster.nativeSlotsRequired).toBe(24);
  });

  it("review queues are QUEUED only — never APPROVED", () => {
    const q = buildPhase15g3aReviewQueues();
    expect(q.length).toBeGreaterThan(21 * 5);
    expect(q.every((i) => i.status === "QUEUED")).toBe(true);
    expect(q.some((i) => (i as { status: string }).status === "APPROVED")).toBe(false);
    const locales = q.filter((i) => i.domain === "localization");
    expect(locales).toHaveLength(24);
  });

  it("credential checklists are blocked until live verification", () => {
    const c = auditAllCredentialChecklists();
    expect(c.countriesComplete).toBe(0);
    expect(c.countriesBlocked).toBe(21);
    expect(c.missingTaxRegistrations).toHaveLength(21);
  });

  it("official sources inventory never APPROVED; technical claims allowlisted", () => {
    const s = auditOfficialSourceClosure();
    expect(s.reviewerStatusNeverApproved).toBe(true);
    expect(s.missingOfficialSourceForTechnicalClaims).toBe(0);
    expect(s.unsupportedSourceDomain).toBe(0);
    expect(s.staleSource).toBe(0);
    expect(s.sourceChecksumDrift).toBe(0);
    expect(s.judgmentQuestionsRemaining.length).toBeGreaterThan(0);
    expect(s.claims.every((c) => c.reviewerStatus !== ("APPROVED" as never))).toBe(true);
  });

  it("approval ingestion rejects unassigned / forged reviewers", () => {
    const counts = emptyApprovalCounts();
    expect(counts.TAX_APPROVED).toBe(0);
    expect(counts.LOCALIZATION_APPROVED).toBe(0);

    const result = validateApprovalIngestion({
      approvalType: "TAX_APPROVAL",
      country: "NO",
      locale: null,
      reviewerIdentity: "forged-person",
      reviewerRole: "tax_reviewer",
      reviewerOrganization: "Forged Org AS",
      reviewerCredential: "fake",
      evidencePackId: "pack-no",
      evidenceChecksum: "abc",
      sourceChecksumSet: [],
      decision: "APPROVE",
      reason: "looks fine",
      scope: "NO tax",
      validFrom: "2026-07-16",
      validTo: "2027-07-16",
      approvedAt: "2026-07-16T00:00:00Z",
      releaseSha: "b88aaf99780e0a5d71404e831fd87eb90031fb6e",
      migrationHead: "20260831120000",
      immutableSignatureHash: "sig",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain("REVIEWER_SLOT_UNASSIGNED");
    }
  });

  it("approval ingestion rejects wrong RC SHA", () => {
    const result = validateApprovalIngestion({
      approvalType: "TAX_APPROVAL",
      country: "NO",
      locale: null,
      reviewerIdentity: "x",
      reviewerRole: "tax_reviewer",
      reviewerOrganization: "y",
      reviewerCredential: "z",
      evidencePackId: "p",
      evidenceChecksum: "c",
      sourceChecksumSet: [],
      decision: "APPROVE",
      reason: "r",
      scope: "s",
      validFrom: "2026-07-16",
      validTo: "2027-07-16",
      approvedAt: "2026-07-16T00:00:00Z",
      releaseSha: "0000000000000000000000000000000000000000",
      migrationHead: "20260831120000",
      immutableSignatureHash: "sig",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain("WRONG_RELEASE_SHA");
  });
});
