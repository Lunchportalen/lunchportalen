/** V1: kode-basert taksonomi — ingen Sanity-schemaendring. */

export const GENERIC_TAGS = ["lunsj", "varmmat"] as const;

const GENERIC_LOWER = new Set(GENERIC_TAGS.map((t) => t.toLowerCase()));

/** Tags som speiler `kitchenStyle`; skal ikke telle i meningsfull tag-overlap. */
export const CUISINE_DUPLICATES = new Set([
  "Norsk/Skandinavisk",
  "Asiatisk",
  "Italiensk/Mediterran",
  "Internasjonalt/Meksikansk",
  "Indisk/Midt-Østen",
]);

/** Tags som speiler protein/diett (felt + generatorregler); ikke meningsfull overlap. */
export const PROTEIN_DUPLICATES = new Set([
  "Kylling",
  "Svin",
  "Okse/Lam",
  "fisk",
  "Fisk/Sjømat",
  "vegetar",
  "Vegetar/Vegan",
]);

export type TagClass = "generic" | "cuisineDup" | "proteinDup" | "meaningful";

export function classifyTag(tag: string): TagClass {
  const t = String(tag ?? "").trim();
  if (!t) return "meaningful";

  if (GENERIC_LOWER.has(t.toLowerCase())) return "generic";
  if (CUISINE_DUPLICATES.has(t)) return "cuisineDup";
  if (PROTEIN_DUPLICATES.has(t)) return "proteinDup";

  return "meaningful";
}

/**
 * Tags som bidrar til variasjons-overlap (normalisert til lowercase for sammenligning).
 * Ekskluderer generic, cuisine- og protein-duplikater fra rå `tags[]`.
 */
export function normalizeMeaningfulTags(rawTags: string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of rawTags ?? []) {
    const t = String(raw).trim();
    if (!t) continue;
    if (classifyTag(raw) !== "meaningful") continue;
    out.add(t.toLowerCase());
  }
  return out;
}
