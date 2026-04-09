import "server-only";

export type SalesLeadLike = {
  company_size?: number;
  pain?: unknown;
  role?: string;
};

/**
 * Deterministisk score (0–120+), ingen nettverkskall.
 */
export function scoreLead(lead: unknown): number {
  if (!lead || typeof lead !== "object" || Array.isArray(lead)) return 0;
  const o = lead as SalesLeadLike;
  let score = 0;
  const cs = typeof o.company_size === "number" && Number.isFinite(o.company_size) ? o.company_size : 0;
  if (cs > 100) score += 50;
  if (typeof o.pain === "string" && o.pain.trim().length > 0) score += 30;
  if (typeof o.role === "string" && o.role.trim().toLowerCase() === "decision_maker") score += 40;
  return score;
}
