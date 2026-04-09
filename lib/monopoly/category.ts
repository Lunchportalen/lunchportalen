/**
 * Kategori-definisjon — enkel, gjentakbar modell for posisjonering.
 * Klarhetsscore er deterministisk (ingen ML).
 */

export type Category = {
  name: string;
  description: string;
  keywords: string[];
  positioning: string;
};

export type CategoryClarityResult = {
  /** 0–100 — hvor komplett og tydelig definisjonen er. */
  score: number;
  explain: string[];
};

/** Eksempel fra strategi — kan kopieres og tilpasses. */
export const EXAMPLE_CATEGORY: Category = {
  name: "Smart lunsjstyring for bedrifter",
  description:
    "Én plattform for bestilling, budsjett og leveranser til ansatte — med sporbarhet for HR og ledelse.",
  keywords: ["lunsj", "bedrift", "catering", "budsjett", "bestilling"],
  positioning: "Erstatter kantine — uten drift",
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normKeywords(kw: unknown): string[] {
  if (!Array.isArray(kw)) return [];
  return kw.map((x) => String(x).trim()).filter(Boolean);
}

/**
 * Beregner kategori-klarhet ut fra lengde, dekning og antall nøkkelord.
 * Samme input gir alltid samme score.
 */
export function scoreCategoryClarity(c: Category): CategoryClarityResult {
  const name = String(c?.name ?? "").trim();
  const description = String(c?.description ?? "").trim();
  const positioning = String(c?.positioning ?? "").trim();
  const keywords = normKeywords(c?.keywords);

  const explain: string[] = [];

  let raw = 0;

  // Navn (0–28)
  if (name.length >= 8) {
    raw += 28;
    explain.push(`Navn: tilstrekkelig (${name.length} tegn) → +28.`);
  } else if (name.length > 0) {
    const pts = Math.round((name.length / 8) * 28);
    raw += pts;
    explain.push(`Navn: kort (${name.length} tegn) → +${pts}.`);
  } else {
    explain.push("Navn: mangler → +0.");
  }

  // Beskrivelse (0–28)
  if (description.length >= 60) {
    raw += 28;
    explain.push(`Beskrivelse: sterk (${description.length} tegn) → +28.`);
  } else if (description.length >= 20) {
    raw += 22;
    explain.push(`Beskrivelse: ok (${description.length} tegn) → +22.`);
  } else if (description.length > 0) {
    const pts = Math.min(18, Math.round((description.length / 20) * 22));
    raw += pts;
    explain.push(`Beskrivelse: tynn (${description.length} tegn) → +${pts}.`);
  } else {
    explain.push("Beskrivelse: mangler → +0.");
  }

  // Nøkkelord (0–22)
  const distinct = [...new Set(keywords.map((k) => k.toLowerCase()))];
  if (distinct.length >= 4) {
    raw += 22;
    explain.push(`Nøkkelord: ${distinct.length} unike → +22.`);
  } else if (distinct.length >= 2) {
    raw += 14;
    explain.push(`Nøkkelord: ${distinct.length} unike → +14.`);
  } else if (distinct.length === 1) {
    raw += 6;
    explain.push("Nøkkelord: kun ett — +6.");
  } else {
    explain.push("Nøkkelord: ingen → +0.");
  }

  // Posisjonering (0–22)
  if (positioning.length >= 24) {
    raw += 22;
    explain.push(`Posisjonering: tydelig (${positioning.length} tegn) → +22.`);
  } else if (positioning.length >= 12) {
    raw += 16;
    explain.push(`Posisjonering: ok (${positioning.length} tegn) → +16.`);
  } else if (positioning.length > 0) {
    const pts = Math.min(12, Math.round((positioning.length / 12) * 16));
    raw += pts;
    explain.push(`Posisjonering: for kort (${positioning.length} tegn) → +${pts}.`);
  } else {
    explain.push("Posisjonering: mangler → +0.");
  }

  const score = clamp100(raw);
  explain.push(`Total: ${score}/100 (avrundet og begrenset 0–100).`);

  return { score, explain };
}
