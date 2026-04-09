import type { MvoComboMetrics } from "./types";

export type PromotedCombo = {
  channel: string;
  segment: string;
  timing: string;
};

/**
 * Mapper vinner-nøkkel `a|b|c` til strategi-objekt (ingen LLM — kun struktur).
 */
export function promoteCombo(combo: [string, MvoComboMetrics] | null): PromotedCombo | null {
  if (!combo) return null;
  const key = combo[0];
  const parts = key.split("|");
  return {
    channel: parts[0] ?? "",
    segment: parts[1] ?? "",
    timing: parts[2] ?? "",
  };
}
