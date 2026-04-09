/**
 * Deterministisk beslutnings-ID uten Node crypto (trygg i kant/klient).
 */

export function stableDecisionId(parts: string[]): string {
  const s = parts.join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return `dec_${(h >>> 0).toString(16).padStart(8, "0")}`;
}
