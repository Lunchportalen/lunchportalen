/**
 * Phase 15G.3B — approval ingestion validation + signature hash.
 * Fixture approvals never count toward GLOBAL_21_READY.
 */

import { createHash } from "node:crypto";
import type { ApprovalType } from "@/lib/review/approvalIngestionContract";
import { PHASE15G3B_MIG_HEAD, PHASE15G3B_RC_SHA } from "@/lib/review/countryReviewPack";
import { assertNoSelfApproval, assertRoleCanApprove, type ReviewerRole } from "@/lib/review/reviewWorkflow";
import { assertScopeAllows } from "@/lib/review/reviewerOperations";

export type ApprovalIngestInput = {
  approvalType: ApprovalType;
  country: string;
  locale: string | null;
  reviewerId: string;
  reviewerRole: ReviewerRole;
  reviewerStatus: "INVITED" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
  reviewerCountryScope: string[];
  reviewerLocaleScope: string[] | null;
  permittedApprovalTypes: string[];
  credentialValidTo: string | null;
  subjectAuthorId: string;
  evidencePackId: string;
  evidenceChecksum: string;
  expectedEvidenceChecksum: string;
  sourceChecksumSet: string[];
  expectedSourceChecksums: string[];
  decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
  reason: string;
  scope: string;
  validFrom: string;
  validTo: string;
  releaseSha: string;
  migrationHead: string;
  isFixture: boolean;
  nowIso?: string;
};

export type ApprovalIngestReject =
  | "REVIEWER_INACTIVE"
  | "REVIEWER_ROLE_MISMATCH"
  | "APPROVAL_TYPE_NOT_PERMITTED"
  | "SCOPE_MISMATCH"
  | "SELF_APPROVAL"
  | "CHECKSUM_MISMATCH"
  | "SOURCE_DRIFT"
  | "EXPIRED_CREDENTIAL"
  | "WRONG_RELEASE_SHA"
  | "MISSING_REASON"
  | "FIXTURE_LABEL_REQUIRED";

const DOMAIN_BY_APPROVAL: Record<ApprovalType, Parameters<typeof assertRoleCanApprove>[1]> = {
  TAX_APPROVAL: "tax",
  LEGAL_APPROVAL: "legal",
  INVOICE_APPROVAL: "invoice",
  E_INVOICE_APPROVAL: "e_invoice",
  PRIVACY_APPROVAL: "privacy",
  NATIVE_LOCALIZATION_APPROVAL: "localization",
  SECURITY_APPROVAL: "privacy",
  PRODUCT_OWNER_APPROVAL: "marketplace",
  REGISTRATION_CREDENTIAL_APPROVAL: "invoice",
};

export function computeApprovalSignatureHash(parts: {
  approvalType: string;
  country: string;
  locale: string | null;
  reviewerId: string;
  decision: string;
  evidenceChecksum: string;
  releaseSha: string;
  migrationHead: string;
  reason: string;
  approvedAt: string;
}): string {
  return createHash("sha256").update(JSON.stringify(parts), "utf8").digest("hex");
}

export function validateApprovalIngest(
  input: ApprovalIngestInput,
): { ok: true; signatureHash: string; approvedAt: string } | { ok: false; reasons: ApprovalIngestReject[] } {
  const reasons: ApprovalIngestReject[] = [];
  const now = input.nowIso ?? new Date().toISOString();

  if (!input.reason.trim()) reasons.push("MISSING_REASON");
  if (input.reviewerStatus !== "ACTIVE") reasons.push("REVIEWER_INACTIVE");
  if (!input.permittedApprovalTypes.includes(input.approvalType)) {
    reasons.push("APPROVAL_TYPE_NOT_PERMITTED");
  }
  if (input.releaseSha !== PHASE15G3B_RC_SHA || input.migrationHead !== PHASE15G3B_MIG_HEAD) {
    reasons.push("WRONG_RELEASE_SHA");
  }
  if (input.evidenceChecksum !== input.expectedEvidenceChecksum) reasons.push("CHECKSUM_MISMATCH");
  const src = new Set(input.sourceChecksumSet);
  if (input.expectedSourceChecksums.some((c) => !src.has(c))) reasons.push("SOURCE_DRIFT");
  if (input.credentialValidTo && input.credentialValidTo < now) reasons.push("EXPIRED_CREDENTIAL");

  try {
    assertNoSelfApproval({
      reviewerId: input.reviewerId,
      role: input.reviewerRole,
      subjectAuthorId: input.subjectAuthorId,
    });
  } catch {
    reasons.push("SELF_APPROVAL");
  }

  try {
    assertRoleCanApprove(input.reviewerRole, DOMAIN_BY_APPROVAL[input.approvalType]);
  } catch {
    reasons.push("REVIEWER_ROLE_MISMATCH");
  }

  try {
    assertScopeAllows({
      countryScope: input.reviewerCountryScope,
      localeScope: input.reviewerLocaleScope,
      country: input.country,
      locale: input.locale,
    });
  } catch {
    reasons.push("SCOPE_MISMATCH");
  }

  if (reasons.length) return { ok: false, reasons };

  const approvedAt = now;
  const signatureHash = computeApprovalSignatureHash({
    approvalType: input.approvalType,
    country: input.country,
    locale: input.locale,
    reviewerId: input.reviewerId,
    decision: input.decision,
    evidenceChecksum: input.evidenceChecksum,
    releaseSha: input.releaseSha,
    migrationHead: input.migrationHead,
    reason: input.reason,
    approvedAt,
  });

  return { ok: true, signatureHash, approvedAt };
}

/** Real (non-fixture) APPROVE counts only. */
export function countRealApprovals(
  rows: Array<{ approval_type: string; decision: string; is_fixture: boolean; country_code: string }>,
): Record<string, number> {
  const real = rows.filter((r) => !r.is_fixture && r.decision === "APPROVE");
  const count = (t: string) => real.filter((r) => r.approval_type === t).length;
  return {
    TAX_APPROVED: count("TAX_APPROVAL"),
    LEGAL_APPROVED: count("LEGAL_APPROVAL"),
    INVOICE_APPROVED: count("INVOICE_APPROVAL"),
    E_INVOICE_APPROVED: count("E_INVOICE_APPROVAL"),
    PRIVACY_APPROVED: count("PRIVACY_APPROVAL"),
    LOCALIZATION_APPROVED: count("NATIVE_LOCALIZATION_APPROVAL"),
    SECURITY_APPROVED: count("SECURITY_APPROVAL"),
    PRODUCT_OWNER_APPROVED: count("PRODUCT_OWNER_APPROVAL"),
    REGISTRATION_CREDENTIAL_APPROVED: count("REGISTRATION_CREDENTIAL_APPROVAL"),
  };
}
