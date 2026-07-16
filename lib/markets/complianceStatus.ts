/**
 * Separated technical vs external-approval statuses (Phase 15G.2B).
 * Technical test/config must NEVER become TAX_APPROVED / LEGAL_APPROVED.
 */

export const TECHNICAL_STATUSES = [
  "TECHNICALLY_CONFIGURED",
  "TECHNICALLY_TESTED",
  "EVIDENCE_COLLECTED",
  "EXTERNAL_REVIEW_REQUIRED",
] as const;

export type TechnicalStatus = (typeof TECHNICAL_STATUSES)[number];

export const APPROVAL_STATUSES = [
  "TAX_APPROVED",
  "LEGAL_APPROVED",
  "INVOICE_APPROVED",
  "LOCALIZATION_APPROVED",
  "READY_FOR_GLOBAL_CUTOVER",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export type ComplianceLane =
  | "tax"
  | "legal"
  | "invoice"
  | "e_invoice"
  | "privacy"
  | "localization"
  | "marketplace";

const TECH_TRANSITIONS: Record<TechnicalStatus, readonly TechnicalStatus[]> = {
  TECHNICALLY_CONFIGURED: ["TECHNICALLY_TESTED", "EVIDENCE_COLLECTED"],
  TECHNICALLY_TESTED: ["EVIDENCE_COLLECTED", "TECHNICALLY_CONFIGURED"],
  EVIDENCE_COLLECTED: ["EXTERNAL_REVIEW_REQUIRED", "TECHNICALLY_TESTED"],
  EXTERNAL_REVIEW_REQUIRED: ["EVIDENCE_COLLECTED"],
};

export function canTransitionTechnical(from: TechnicalStatus, to: TechnicalStatus): boolean {
  return TECH_TRANSITIONS[from].includes(to);
}

export function assertTechnicalTransition(from: TechnicalStatus, to: TechnicalStatus): void {
  if (!canTransitionTechnical(from, to)) {
    throw new Error(`TECHNICAL_STATUS_TRANSITION_FORBIDDEN:${from}->${to}`);
  }
}

/** Technical progress must never be recorded as a human approval status. */
export function assertNotForgedApproval(status: string): void {
  if ((APPROVAL_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`FORGED_APPROVAL_STATUS_FORBIDDEN:${status}`);
  }
}

export function activationBlockedReasons(args: {
  technical21Complete: boolean;
  taxApprovedCount: number;
  legalApprovedCount: number;
  invoiceApprovedCount: number;
  eInvoiceApprovedOrNa: number;
  privacyApprovedCount: number;
  localizationApprovedCount: number;
}): string[] {
  const reasons: string[] = [];
  if (!args.technical21Complete) reasons.push("TECHNICAL_21_INCOMPLETE");
  if (args.taxApprovedCount < 21) reasons.push(`TAX_APPROVED:${args.taxApprovedCount}/21`);
  if (args.legalApprovedCount < 21) reasons.push(`LEGAL_APPROVED:${args.legalApprovedCount}/21`);
  if (args.invoiceApprovedCount < 21) reasons.push(`INVOICE_APPROVED:${args.invoiceApprovedCount}/21`);
  if (args.eInvoiceApprovedOrNa < 21) reasons.push(`E_INVOICE:${args.eInvoiceApprovedOrNa}/21`);
  if (args.privacyApprovedCount < 21) reasons.push(`PRIVACY_APPROVED:${args.privacyApprovedCount}/21`);
  if (args.localizationApprovedCount < 24) {
    reasons.push(`LOCALIZATION_APPROVED:${args.localizationApprovedCount}/24`);
  }
  return reasons;
}
