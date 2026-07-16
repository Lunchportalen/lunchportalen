/**
 * Phase 15G.3A — Gate 10 approval ingestion contract.
 * Rejects forged / incomplete approvals. Never invents reviewer identity.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { REVIEWER_ROSTER_SLOTS } from "@/lib/review/reviewerRosterSlots";

export type ApprovalType =
  | "TAX_APPROVAL"
  | "LEGAL_APPROVAL"
  | "INVOICE_APPROVAL"
  | "E_INVOICE_APPROVAL"
  | "PRIVACY_APPROVAL"
  | "NATIVE_LOCALIZATION_APPROVAL"
  | "SECURITY_APPROVAL"
  | "PRODUCT_OWNER_APPROVAL"
  | "REGISTRATION_CREDENTIAL_APPROVAL";

export type ApprovalIngestionPayload = {
  approvalType: ApprovalType;
  country: CountryCode | "ALL";
  locale: string | null;
  reviewerIdentity: string;
  reviewerRole: string;
  reviewerOrganization: string;
  reviewerCredential: string;
  evidencePackId: string;
  evidenceChecksum: string;
  sourceChecksumSet: string[];
  decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
  reason: string;
  scope: string;
  validFrom: string;
  validTo: string;
  approvedAt: string;
  releaseSha: string;
  migrationHead: string;
  immutableSignatureHash: string;
  /** Must differ from any subject author — enforced by caller when known. */
  subjectAuthorId?: string;
};

export type IngestionRejectReason =
  | "REVIEWER_MISSING"
  | "REVIEWER_SCOPE_MISMATCH"
  | "SELF_APPROVAL"
  | "CHECKSUM_MISMATCH"
  | "SOURCE_DRIFT"
  | "EXPIRED_CREDENTIAL"
  | "WRONG_RELEASE_SHA"
  | "MISSING_DECISION_REASON"
  | "REVIEWER_SLOT_UNASSIGNED"
  | "INVALID_COUNTRY";

const EXPECTED_RC_SHA = "b88aaf99780e0a5d71404e831fd87eb90031fb6e";
const EXPECTED_MIG = "20260901120000";

export function validateApprovalIngestion(
  payload: ApprovalIngestionPayload,
  opts?: {
    expectedEvidenceChecksum?: string;
    expectedSourceChecksums?: string[];
    nowIso?: string;
  },
): { ok: true } | { ok: false; reasons: IngestionRejectReason[] } {
  const reasons: IngestionRejectReason[] = [];

  if (!payload.reviewerIdentity?.trim() || !payload.reviewerOrganization?.trim() || !payload.reviewerCredential?.trim()) {
    reasons.push("REVIEWER_MISSING");
  }
  if (!payload.reason?.trim()) reasons.push("MISSING_DECISION_REASON");
  if (payload.releaseSha !== EXPECTED_RC_SHA) reasons.push("WRONG_RELEASE_SHA");
  if (payload.migrationHead !== EXPECTED_MIG) reasons.push("WRONG_RELEASE_SHA");

  if (payload.country !== "ALL" && !SUPPORTED_COUNTRY_CODES.includes(payload.country)) {
    reasons.push("INVALID_COUNTRY");
  }

  if (payload.subjectAuthorId && payload.subjectAuthorId === payload.reviewerIdentity) {
    reasons.push("SELF_APPROVAL");
  }

  if (opts?.expectedEvidenceChecksum && opts.expectedEvidenceChecksum !== payload.evidenceChecksum) {
    reasons.push("CHECKSUM_MISMATCH");
  }

  if (opts?.expectedSourceChecksums) {
    const set = new Set(payload.sourceChecksumSet);
    if (opts.expectedSourceChecksums.some((c) => !set.has(c))) {
      reasons.push("SOURCE_DRIFT");
    }
  }

  const slot = REVIEWER_ROSTER_SLOTS.find(
    (s) =>
      s.reviewerId === payload.reviewerIdentity &&
      s.permittedApprovalTypes.includes(payload.approvalType) &&
      s.status === "ASSIGNED",
  );
  if (!slot) {
    reasons.push("REVIEWER_SLOT_UNASSIGNED");
  } else {
    if (payload.country !== "ALL") {
      const scopeOk = slot.countryScope === "ALL" || slot.countryScope.includes(payload.country);
      if (!scopeOk) reasons.push("REVIEWER_SCOPE_MISMATCH");
    }
    if (payload.locale && slot.localeScope && slot.localeScope !== "ALL") {
      if (!slot.localeScope.includes(payload.locale)) reasons.push("REVIEWER_SCOPE_MISMATCH");
    }
    const now = opts?.nowIso ?? new Date().toISOString();
    if (slot.validTo && slot.validTo < now) reasons.push("EXPIRED_CREDENTIAL");
  }

  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}

/** Honest counts — no inference from technical status. */
export function emptyApprovalCounts() {
  return {
    TAX_APPROVED: 0,
    LEGAL_APPROVED: 0,
    INVOICE_APPROVED: 0,
    E_INVOICE_APPROVED_OR_NOT_APPLICABLE: 1, // US NOT_APPLICABLE only — not a forged APPROVED
    PRIVACY_APPROVED: 0,
    LOCALIZATION_APPROVED: 0,
    SECURITY_APPROVED: 0,
    PRODUCT_OWNER_APPROVED: 0,
    REGISTRATION_CREDENTIAL_APPROVED: 0,
    READY_FOR_GLOBAL_CUTOVER: 0,
  } as const;
}
