/**
 * Shared keyword seeds and intent helpers for growth / SEO (deterministic, no LLM).
 * Norwegian B2B context for workplace lunch / kantine alternatives.
 */

export const LUNCHPORTALEN_KEYWORD_SEEDS = [
  "lunsjordning bedrift",
  "alternativ til kantine",
  "bedriftslunsj levering",
  "kontorlunsj bestilling",
  "mat til møter bedrift",
  "bærekraftig bedriftslunsj",
  "lunsjportal",
  "samlet lunsj på arbeidsplassen",
] as const;

export type SearchIntent = "informational" | "commercial" | "navigational";

export function intentForPhrase(phrase: string): SearchIntent {
  const p = phrase.toLowerCase();
  if (p.includes("pris") || p.includes("bestill") || p.includes("demo") || p.includes("kontakt")) {
    return "commercial";
  }
  if (p.includes("hva er") || p.includes("hvordan") || p.includes("guide")) {
    return "informational";
  }
  if (p.includes("login") || p.includes("logg inn") || p.includes("lunchportalen")) {
    return "navigational";
  }
  return "informational";
}

export function expandKeywordSeeds(existing: string[]): string[] {
  const lower = new Set(existing.map((s) => s.toLowerCase().trim()));
  const out: string[] = [];
  for (const seed of LUNCHPORTALEN_KEYWORD_SEEDS) {
    if (!lower.has(seed)) out.push(seed);
  }
  return out;
}
