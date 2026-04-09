import "server-only";

export type GeneratedLead = { company: string; size: number };

/**
 * Deterministic synthetic leads (no randomness — RC-safe).
 */
export function generateLeads(n = 10): GeneratedLead[] {
  const cap = Math.min(Math.max(Math.floor(n), 1), 50);
  const leads: GeneratedLead[] = [];
  for (let i = 0; i < cap; i++) {
    const size = (i * 37 + 11) % 501;
    leads.push({
      company: `Company ${i}`,
      size,
    });
  }
  return leads;
}
