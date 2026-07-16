/**
 * Phase 15G.3B — packs, questions, queue, ingestion negatives, fixtures isolated.
 */
import { describe, expect, it } from "vitest";
import { auditAllCountryReviewPacks, buildCountryReviewPack } from "@/lib/review/countryReviewPack";
import { classifyAllCriticalQuestions } from "@/lib/review/criticalQuestions";
import { assertQueueDeterministic, buildDeterministicReviewQueue } from "@/lib/review/queueOperations";
import {
  validateApprovalIngest,
  countRealApprovals,
  computeApprovalSignatureHash,
} from "@/lib/review/approvalIngestionService";
import {
  validateReviewerProfileInput,
  assertNoSuperadminSelfReview,
  hashReviewerEmail,
} from "@/lib/review/reviewerOperations";
import { validateEvidenceUpload, assertNoSecretInMetadata } from "@/lib/review/evidenceUpload";
import { buildReviewerStaffingPlan } from "@/lib/review/staffingPlan";
import {
  buildRegistrationRequirementSeeds,
  summarizeRegistrationSeeds,
} from "@/lib/review/registrationOperations";
import { PHASE15G3B_MIG_HEAD, PHASE15G3B_RC_SHA } from "@/lib/review/countryReviewPack";

describe("Phase 15G.3B review operations", () => {
  it("21/21 packs review-ready with 0 MISSING fields", () => {
    const audit = auditAllCountryReviewPacks();
    expect(audit.packs).toHaveLength(21);
    expect(audit.summary.reviewReady).toBe(21);
    expect(audit.summary.missingMandatoryFields).toBe(0);
    expect(audit.summary.unclassifiedCriticalQuestions).toBe(0);
    expect(audit.summary.externalDecisionsRequired).toBeGreaterThan(0);
    for (const p of audit.packs) {
      expect(p.fields.every((f) => f.status !== "MISSING")).toBe(true);
      expect(p.approvals.tax).toBe("NONE");
    }
  });

  it("critical questions classified with tasks; none unclassified", () => {
    const q = classifyAllCriticalQuestions();
    expect(q.unclassified).toBe(0);
    expect(q.withoutTask).toBe(0);
    expect(q.externalDecisionRequired).toBeGreaterThan(0);
    expect(q.closedFactual).toBeGreaterThan(0);
  });

  it("queue deterministic, no duplicates, all on RC SHA", () => {
    const stats = assertQueueDeterministic();
    expect(stats.duplicates).toBe(0);
    expect(stats.count).toBeGreaterThan(100);
    const tasks = buildDeterministicReviewQueue();
    expect(tasks.every((t) => t.releaseSha === PHASE15G3B_RC_SHA)).toBe(true);
    expect(tasks.every((t) => t.status === "QUEUED")).toBe(true);
  });

  it("rejects self-approval, wrong scope, stale checksum, expired credential", () => {
    const pack = buildCountryReviewPack("NO");
    const base = {
      approvalType: "TAX_APPROVAL" as const,
      country: "NO",
      locale: null,
      reviewerId: "rev-1",
      reviewerRole: "tax_reviewer" as const,
      reviewerStatus: "ACTIVE" as const,
      reviewerCountryScope: ["NO"],
      reviewerLocaleScope: null,
      permittedApprovalTypes: ["TAX_APPROVAL"],
      credentialValidTo: "2099-01-01T00:00:00.000Z",
      subjectAuthorId: "author-1",
      evidencePackId: "p",
      evidenceChecksum: pack.packChecksum,
      expectedEvidenceChecksum: pack.packChecksum,
      sourceChecksumSet: ["abc"],
      expectedSourceChecksums: ["abc"],
      decision: "APPROVE" as const,
      reason: "ok",
      scope: "NO",
      validFrom: "2026-07-16T00:00:00.000Z",
      validTo: "2027-07-16T00:00:00.000Z",
      releaseSha: PHASE15G3B_RC_SHA,
      migrationHead: PHASE15G3B_MIG_HEAD,
      isFixture: true,
    };

    expect(validateApprovalIngest({ ...base, subjectAuthorId: "rev-1" }).ok).toBe(false);
    expect(validateApprovalIngest({ ...base, reviewerCountryScope: ["SE"] }).ok).toBe(false);
    expect(
      validateApprovalIngest({ ...base, evidenceChecksum: "stale", expectedEvidenceChecksum: pack.packChecksum })
        .ok,
    ).toBe(false);
    expect(
      validateApprovalIngest({
        ...base,
        credentialValidTo: "2020-01-01T00:00:00.000Z",
        nowIso: "2026-07-16T00:00:00.000Z",
      }).ok,
    ).toBe(false);

    const ok = validateApprovalIngest(base);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.signatureHash).toBe(
        computeApprovalSignatureHash({
          approvalType: "TAX_APPROVAL",
          country: "NO",
          locale: null,
          reviewerId: "rev-1",
          decision: "APPROVE",
          evidenceChecksum: pack.packChecksum,
          releaseSha: PHASE15G3B_RC_SHA,
          migrationHead: PHASE15G3B_MIG_HEAD,
          reason: "ok",
          approvedAt: ok.approvedAt,
        }),
      );
    }
  });

  it("fixture approvals never count as real", () => {
    const counts = countRealApprovals([
      {
        approval_type: "TAX_APPROVAL",
        decision: "APPROVE",
        is_fixture: true,
        country_code: "NO",
      },
      {
        approval_type: "TAX_APPROVAL",
        decision: "APPROVE",
        is_fixture: false,
        country_code: "SE",
      },
    ]);
    expect(counts.TAX_APPROVED).toBe(1);
  });

  it("reviewer onboarding validation + superadmin self-review block", () => {
    const errors = validateReviewerProfileInput({
      displayLabel: "TEST_FIXTURE Tax NO",
      organization: "Fixture Org",
      email: "fixture-tax-no@example.test",
      role: "tax_reviewer",
      countryScope: ["NO"],
      localeScope: null,
      permittedApprovalTypes: ["TAX_APPROVAL"],
      credentialReference: "bar-ref",
      credentialSecretRef: "vault://reviewers/fixture-tax-no",
      credentialValidFrom: "2026-01-01T00:00:00.000Z",
      credentialValidTo: "2027-01-01T00:00:00.000Z",
      conflictOfInterestDeclared: true,
      authUserId: null,
      isTestFixture: true,
      actorId: "sa-1",
    });
    expect(errors).toEqual([]);

    expect(() =>
      assertNoSuperadminSelfReview({
        actorIsSuperadmin: true,
        actorId: "sa-1",
        reviewerAuthUserId: "sa-1",
        separationRequired: true,
      }),
    ).toThrow(/SUPERADMIN_SELF_REVIEWER_FORBIDDEN/);

    expect(hashReviewerEmail("A@B.com")).toBe(hashReviewerEmail("a@b.com"));
  });

  it("evidence upload rejects bad mime/size/secrets", () => {
    expect(
      validateEvidenceUpload({
        countryCode: "NO",
        queueItemId: null,
        approvalType: null,
        mimeType: "application/x-msdownload",
        byteSize: 100,
        uploadedBy: "u1",
        isFixture: true,
        originalFileName: "x.pdf",
      }).length,
    ).toBeGreaterThan(0);
    expect(() => assertNoSecretInMetadata({ note: "-----BEGIN PRIVATE KEY-----" })).toThrow();
  });

  it("staffing plan has unfilled scopes; registrations workflow ready", () => {
    const plan = buildReviewerStaffingPlan();
    expect(plan.minimumCoverage.tax).toBe(21);
    expect(plan.minimumCoverage.native).toBe(24);
    expect(plan.filled.tax).toBe(0);
    expect(plan.unfilledScopes.length).toBeGreaterThan(60);

    const regs = buildRegistrationRequirementSeeds();
    const sum = summarizeRegistrationSeeds(regs);
    expect(sum.workflowReady).toBe(true);
    expect(sum.countriesVerified).toBe(0);
    expect(sum.secretLeakage).toBe(0);
  });
});
