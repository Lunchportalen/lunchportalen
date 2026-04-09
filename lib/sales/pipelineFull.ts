import "server-only";

export type LeadLike = {
  company?: unknown;
  company_size?: unknown;
};

/**
 * Deterministic pipeline stage — no side effects.
 */
export function processLead(lead: LeadLike): {
  stage: "qualified";
  score: "high" | "low";
} {
  const raw = lead?.company_size;
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
  const companySize = typeof n === "number" && Number.isFinite(n) ? n : 0;

  return {
    stage: "qualified",
    score: companySize > 50 ? "high" : "low",
  };
}
