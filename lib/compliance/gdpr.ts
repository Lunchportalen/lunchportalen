/**
 * Pseudonymization helper for exports / external payloads — not for operational investigation UI.
 */

export function anonymizeUser(userId: string | null | undefined): string | null {
  if (userId == null) return null;
  const s = String(userId).trim();
  if (!s) return null;
  return `hashed_${s}`;
}
