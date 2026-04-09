/**
 * Duplikatfilter for beslutningsliste (deterministisk nøkkel).
 */

import type { Decision } from "@/lib/social/decisionEngine";

function stableDataKey(data: Record<string, unknown>): string {
  const keys = Object.keys(data).sort();
  return keys.map((k) => `${k}:${JSON.stringify(data[k])}`).join("|");
}

export function preventDuplicates(decisions: Decision[]): Decision[] {
  const seen = new Set<string>();
  return decisions.filter((d) => {
    const key = `${d.type}:${stableDataKey(d.data)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
