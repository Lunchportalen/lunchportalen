/**
 * Deterministic B2B lead scoring (rule layer — same inputs ⇒ same score).
 */
export type GtmLeadInput = {
  id?: string;
  employees?: number;
  hasCanteen?: boolean;
  industry?: string;
  company?: string;
  name?: string;
  email?: string;
};

export function scoreLead(lead: GtmLeadInput): number {
  let score = 0;
  const n = typeof lead.employees === "number" && Number.isFinite(lead.employees) ? lead.employees : 0;
  if (n >= 20) score += 3;
  if (n >= 100) score += 5;
  if (lead.hasCanteen === true) score += 2;
  if (String(lead.industry ?? "").toLowerCase() === "office") score += 2;
  return score;
}
