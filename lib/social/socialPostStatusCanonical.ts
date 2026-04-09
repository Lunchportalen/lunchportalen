/**
 * Kanonisk status for Lunchportalen social_posts (DB `status` tekst).
 * Legacy: planned, ready — mappes til visning uten migrasjon.
 */

export const SOCIAL_POST_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "scheduled",
  "published",
  "cancelled",
  "failed",
  "planned",
  "ready",
] as const;

export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

const STATUS_SET = new Set<string>(SOCIAL_POST_STATUSES);

export function normalizeSocialPostStatus(raw: unknown): SocialPostStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if (STATUS_SET.has(s)) return s as SocialPostStatus;
  if (s === "processing") return "scheduled";
  return "draft";
}

/** Visningsnøkkel for UI (norsk etikett i klient). */
export function statusDisplayKey(status: SocialPostStatus): string {
  switch (status) {
    case "draft":
    case "planned":
      return "draft";
    case "in_review":
      return "in_review";
    case "approved":
    case "ready":
      return "approved";
    case "scheduled":
      return "scheduled";
    case "published":
      return "published";
    case "cancelled":
      return "cancelled";
    case "failed":
      return "failed";
    default:
      return "draft";
  }
}

function bucketForRules(s: SocialPostStatus): "draft" | "in_review" | "approved" | "scheduled" | "published" | "failed" | "cancelled" {
  if (s === "planned") return "draft";
  if (s === "ready") return "approved";
  if (s === "draft") return "draft";
  if (s === "in_review") return "in_review";
  if (s === "approved") return "approved";
  if (s === "scheduled") return "scheduled";
  if (s === "published") return "published";
  if (s === "failed") return "failed";
  return "cancelled";
}

/**
 * Tillatte overganger (review-first). `published` og `cancelled` er terminal.
 */
export function canTransitionSocialPostStatus(from: SocialPostStatus, to: SocialPostStatus): boolean {
  if (from === to) return true;
  const bf = bucketForRules(from);
  const bt = bucketForRules(to);
  if (bf === "published" || bf === "cancelled") return false;
  if (bt === "cancelled") return true;

  const allowed: Record<string, string[]> = {
    draft: ["in_review"],
    in_review: ["approved", "draft"],
    approved: ["scheduled"],
    /** `published` settes kun via dedikert publish-endepunkt, ikke PATCH. */
    scheduled: ["failed"],
    failed: ["draft"],
  };

  return (allowed[bf] ?? []).includes(bt);
}
