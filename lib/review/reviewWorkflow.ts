/**
 * Human review workflow — tax / legal / native / security / product owner.
 * No self-approval. Append-only history. Never forges APPROVED in code paths used by Cursor.
 */

export type ReviewerRole =
  | "tax_reviewer"
  | "legal_reviewer"
  | "native_language_reviewer"
  | "security_reviewer"
  | "product_owner";

export type ReviewDecision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";

export type ReviewQueueItem = {
  id: string;
  domain: "tax" | "legal" | "invoice" | "e_invoice" | "privacy" | "localization" | "marketplace";
  countryCode: string;
  locale: string | null;
  subjectId: string;
  evidenceChecksum: string;
  status: "QUEUED" | "IN_REVIEW" | "APPROVED" | "BLOCKED" | "EXPIRED";
  createdAt: string;
};

export type ReviewHistoryEntry = {
  id: string;
  queueItemId: string;
  reviewerId: string;
  reviewerRole: ReviewerRole;
  decision: ReviewDecision;
  evidenceChecksum: string;
  decidedAt: string;
  notes: string;
};

export type ReviewerIdentity = {
  reviewerId: string;
  role: ReviewerRole;
  /** Subject author / last editor — cannot approve own work. */
  subjectAuthorId: string;
};

export function assertNoSelfApproval(identity: ReviewerIdentity): void {
  if (identity.reviewerId === identity.subjectAuthorId) {
    throw new Error(`SELF_APPROVAL_FORBIDDEN:${identity.reviewerId}`);
  }
}

export function assertRoleCanApprove(role: ReviewerRole, domain: ReviewQueueItem["domain"]): void {
  const map: Record<ReviewQueueItem["domain"], ReviewerRole[]> = {
    tax: ["tax_reviewer"],
    legal: ["legal_reviewer"],
    invoice: ["tax_reviewer", "legal_reviewer"],
    e_invoice: ["tax_reviewer", "legal_reviewer"],
    privacy: ["legal_reviewer", "security_reviewer"],
    localization: ["native_language_reviewer"],
    marketplace: ["legal_reviewer", "product_owner"],
  };
  if (!map[domain].includes(role)) {
    throw new Error(`REVIEWER_ROLE_FORBIDDEN:${role}:${domain}`);
  }
}

/**
 * Record a human decision. Does not mutate underlying rule content.
 * REJECT → BLOCKED. APPROVE only when evidence checksum matches current.
 */
export function applyReviewDecision(args: {
  item: ReviewQueueItem;
  identity: ReviewerIdentity;
  decision: ReviewDecision;
  evidenceChecksumNow: string;
  decidedAt: string;
  notes: string;
  historyId: string;
}): { item: ReviewQueueItem; history: ReviewHistoryEntry } {
  assertNoSelfApproval(args.identity);
  assertRoleCanApprove(args.identity.role, args.item.domain);

  if (args.item.evidenceChecksum !== args.evidenceChecksumNow) {
    return {
      item: { ...args.item, status: "EXPIRED" },
      history: {
        id: args.historyId,
        queueItemId: args.item.id,
        reviewerId: args.identity.reviewerId,
        reviewerRole: args.identity.role,
        decision: "REQUEST_CHANGES",
        evidenceChecksum: args.evidenceChecksumNow,
        decidedAt: args.decidedAt,
        notes: "Evidence checksum drifted before approval; approval expired.",
      },
    };
  }

  if (args.decision === "REJECT" || args.decision === "REQUEST_CHANGES") {
    return {
      item: { ...args.item, status: "BLOCKED" },
      history: {
        id: args.historyId,
        queueItemId: args.item.id,
        reviewerId: args.identity.reviewerId,
        reviewerRole: args.identity.role,
        decision: args.decision,
        evidenceChecksum: args.evidenceChecksumNow,
        decidedAt: args.decidedAt,
        notes: args.notes,
      },
    };
  }

  // APPROVE — still requires human caller; this helper never invents reviewerId.
  if (!args.identity.reviewerId.trim()) {
    throw new Error("REVIEWER_IDENTITY_REQUIRED");
  }

  return {
    item: { ...args.item, status: "APPROVED" },
    history: {
      id: args.historyId,
      queueItemId: args.item.id,
      reviewerId: args.identity.reviewerId,
      reviewerRole: args.identity.role,
      decision: "APPROVE",
      evidenceChecksum: args.evidenceChecksumNow,
      decidedAt: args.decidedAt,
      notes: args.notes,
    },
  };
}

export function countryActivationBlockedReasons(args: {
  taxApproved: boolean;
  legalApproved: boolean;
  invoiceApproved: boolean;
  eInvoiceApprovedOrNa: boolean;
  privacyApproved: boolean;
  marketplaceApproved: boolean;
  nativeLocalesApproved: boolean;
}): string[] {
  const reasons: string[] = [];
  if (!args.taxApproved) reasons.push("TAX_NOT_APPROVED");
  if (!args.legalApproved) reasons.push("LEGAL_NOT_APPROVED");
  if (!args.invoiceApproved) reasons.push("INVOICE_NOT_APPROVED");
  if (!args.eInvoiceApprovedOrNa) reasons.push("E_INVOICE_NOT_APPROVED");
  if (!args.privacyApproved) reasons.push("PRIVACY_NOT_APPROVED");
  if (!args.marketplaceApproved) reasons.push("MARKETPLACE_NOT_APPROVED");
  if (!args.nativeLocalesApproved) reasons.push("NATIVE_LOCALES_NOT_APPROVED");
  return reasons;
}
