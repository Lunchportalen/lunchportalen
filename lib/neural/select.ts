import type { PolicyScores } from "@/lib/neural/model";

/** Deterministic argmax over score entries (stable tie-break: key order from Object.entries). */
export function selectAction(scores: PolicyScores): string | null {
  const entries = Object.entries(scores);
  if (entries.length === 0) return null;
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return entries[0][0];
}
