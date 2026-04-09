export type LeadClassifyInput = {
  company_size?: number | null;
};

export type LeadSegment = "enterprise" | "mid_market" | "smb";

/**
 * Deterministic B2B tiering (display / routing only — no side effects).
 */
export function classifyLead(input: LeadClassifyInput): LeadSegment {
  const n = typeof input.company_size === "number" && Number.isFinite(input.company_size) ? input.company_size : 0;
  if (n > 500) return "enterprise";
  if (n > 50) return "mid_market";
  return "smb";
}
