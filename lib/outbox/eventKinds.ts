/**
 * K1 — Outbox event_kind routing contract.
 * Single source of truth for which prefixes each worker may claim.
 */

/** State markers closed as SENT noop by the SMTP worker. */
export const OUTBOX_STATE_EVENT_PREFIXES = ["order.set:", "rollup.rebuild:"] as const;

/** SMTP email queue — declared prefixes (payload may still require from/to/subject). */
export const OUTBOX_SMTP_EMAIL_PREFIXES = [
  "company.approved:",
  "company.rejected:",
  "company.activated:",
  "deviation:",
  "batch_packed:",
  "daily_order_summary:",
  "daily_kitchen_production:",
  "order.cancel.day_choice:",
] as const;

/** Tripletex worker (`/api/system/outbox/process`) — LIKE patterns per batch pass. */
export const OUTBOX_TRIPLETEX_EVENT_LIKE_PATTERNS = [
  "invoice.ready:%",
  "tripletex.provider_customer_create_lp:%",
  "tripletex.company_customer_create_provider:%",
  "tripletex.saas_invoice_create_lp:%",
  "tripletex.agreement_invoice_create_provider:%",
  "tripletex.provider_product_sync:%",
  "tripletex.onboarding_provisioning_start:%",
] as const;

/**
 * Prefixes the SMTP worker must NOT claim via `lp_outbox_claim`.
 * Covers all Tripletex pipeline keys plus invoice.* lifecycle keys owned by the Tripletex worker.
 */
export const OUTBOX_SMTP_CLAIM_EXCLUDE_PREFIXES = [
  "invoice.ready:",
  "invoice.reverse:",
  "invoice.sent:",
  "tripletex.",
] as const;

export type OutboxStateEventPrefix = (typeof OUTBOX_STATE_EVENT_PREFIXES)[number];
export type OutboxSmtpEmailPrefix = (typeof OUTBOX_SMTP_EMAIL_PREFIXES)[number];
export type OutboxTripletexEventLikePattern = (typeof OUTBOX_TRIPLETEX_EVENT_LIKE_PATTERNS)[number];
export type OutboxSmtpClaimExcludePrefix = (typeof OUTBOX_SMTP_CLAIM_EXCLUDE_PREFIXES)[number];

export function isOutboxKeyExcludedFromSmtpClaim(eventKey: string): boolean {
  const key = String(eventKey ?? "").trim();
  if (!key) return false;
  return OUTBOX_SMTP_CLAIM_EXCLUDE_PREFIXES.some((prefix) => key.startsWith(prefix));
}
