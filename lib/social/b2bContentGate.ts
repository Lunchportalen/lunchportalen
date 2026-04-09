/**
 * Pre-publish filter: blokker for uformelt / rent «mat»-fokus uten bedriftsvinkel.
 */

const FORBIDDEN_CTA = /\bkjøp\s*nå\b|\bbestill\s+mat\b|\bbestill\s+her\b/gi;

const BUSINESS_SIGNAL =
  /\b(bedrift|bedrifter|kontor|arbeidsplass|ansatte|HR|drift|lunsjordning|beslutning|leder|ledere|avtale|forutsigbar|kostnad|arbeidsmiljø|hverdag|B2B|demo|tilbud|løsning)\b/i;

/** Typisk «foodie» uten bedrift – blokkeres hvis ingen bedriftssignal. */
const CASUAL_FOOD =
  /\b(nam\s*!|så\s+godt|yummy|oppskrift|foodie|instagrammat|kveldsmat|middag\s+hjemme)\b/i;

export type B2bContentGateResult = { ok: true } | { ok: false; reasons: string[] };

export function validateB2bLeadContent(fullText: string): B2bContentGateResult {
  const t = String(fullText ?? "").trim();
  const reasons: string[] = [];

  if (t.length < 80) {
    reasons.push("Teksten er for kort for B2B lead-melding.");
  }

  if (FORBIDDEN_CTA.test(t)) {
    reasons.push("Inneholder forbudt konsument-CTA (bruk demo / tilbud / løsning).");
  }

  if (!BUSINESS_SIGNAL.test(t)) {
    reasons.push("Mangler tydelig bedrifts- eller kontorvinkel.");
  }

  if (CASUAL_FOOD.test(t) && !BUSINESS_SIGNAL.test(t)) {
    reasons.push("For uformelt eller rent matfokus uten B2B-ramme.");
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
