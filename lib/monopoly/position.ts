/**
 * Posisjonering — låst budskap med bevis og differensiering.
 * Styrke-score og validering er **deterministiske** og kan forsvares linje for linje (ingen ML).
 */

export type Position = {
  coreMessage: string;
  proofPoints: string[];
  differentiation: string[];
};

export type PositionValidation = {
  /** Kjernebudskap + nok substans i listene (terskler under). */
  clear: boolean;
  /** Minimalt overlapp og duplikater — tydelig egenprofil. */
  unique: boolean;
  /** Kan gjentas i salg/marked uten å miste mening (nok bevis og struktur). */
  repeatable: boolean;
};

export type PositionStrengthResult = {
  /** 0–100 */
  score: number;
  explain: string[];
  validation: PositionValidation;
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normList(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x).trim()).filter(Boolean);
}

function lowerSet(items: string[]): Set<string> {
  return new Set(items.map((s) => s.toLowerCase()));
}

/** Andel unike (normalisert) linjer; 1 = ingen duplikater. */
function distinctRatio(items: string[]): number {
  if (items.length === 0) return 0;
  const set = lowerSet(items);
  return set.size / items.length;
}

/** Del av `a` som finnes ordrett i `b` (normalisert). */
function overlapFraction(a: string[], b: string[]): number {
  if (a.length === 0) return 0;
  const bs = lowerSet(b);
  let hit = 0;
  for (const x of a) {
    if (bs.has(x.toLowerCase())) hit += 1;
  }
  return hit / a.length;
}

/**
 * Vurderer om posisjonen er tydelig nok til å forsvares eksternt.
 */
function validateClear(core: string, proofs: string[], diffs: string[]): boolean {
  if (core.trim().length < 20) return false;
  if (proofs.length < 2 || diffs.length < 2) return false;
  const minItem = 10;
  return proofs.every((p) => p.length >= minItem) && diffs.every((d) => d.length >= minItem);
}

/**
 * Unikhet: ingen duplikater internt, begrenset kryss-gjentakelse mellom bevis og differensiering.
 */
function validateUnique(proofs: string[], diffs: string[]): boolean {
  if (proofs.length === 0 || diffs.length === 0) return false;
  if (distinctRatio(proofs) < 1 || distinctRatio(diffs) < 1) return false;
  return overlapFraction(proofs, diffs) <= 0.15;
}

/**
 * Gjentakbarhet: nok materiale til playbook og konsistent messaging.
 */
function validateRepeatable(core: string, proofs: string[], diffs: string[]): boolean {
  return core.trim().length >= 28 && proofs.length >= 3 && diffs.length >= 2;
}

/**
 * Beregner posisjonsstyrke (0–100) og tre valideringsflagg.
 * Samme input gir alltid samme output.
 */
export function scorePositionStrength(p: Position): PositionStrengthResult {
  const core = String(p?.coreMessage ?? "").trim();
  const proofs = normList(p?.proofPoints);
  const diffs = normList(p?.differentiation);

  const explain: string[] = [];

  const clear = validateClear(core, proofs, diffs);
  const unique = validateUnique(proofs, diffs);
  const repeatable = validateRepeatable(core, proofs, diffs);

  let raw = 0;

  // Kjernebudskap (0–30)
  if (core.length >= 40) {
    raw += 30;
    explain.push(`Kjernebudskap: sterkt (${core.length} tegn) → +30.`);
  } else if (core.length >= 24) {
    raw += 24;
    explain.push(`Kjernebudskap: ok (${core.length} tegn) → +24.`);
  } else if (core.length >= 12) {
    raw += 14;
    explain.push(`Kjernebudskap: tynt (${core.length} tegn) → +14.`);
  } else if (core.length > 0) {
    raw += 6;
    explain.push(`Kjernebudskap: for kort (${core.length} tegn) → +6.`);
  } else {
    explain.push("Kjernebudskap: mangler → +0.");
  }

  // Bevispunkter (0–28)
  const prRatio = distinctRatio(proofs);
  if (proofs.length >= 4 && proofs.every((x) => x.length >= 12) && prRatio >= 1) {
    raw += 28;
    explain.push(`Bevis: ${proofs.length} tydelige, unike punkter → +28.`);
  } else if (proofs.length >= 2 && prRatio >= 1) {
    const pts = Math.min(22, 12 + proofs.length * 2);
    raw += pts;
    explain.push(`Bevis: ${proofs.length} punkt(er), unikhetsgrad ${(prRatio * 100).toFixed(0)} % → +${pts}.`);
  } else if (proofs.length >= 1) {
    raw += 8;
    explain.push(`Bevis: utilstrekkelig struktur (${proofs.length} punkt) → +8.`);
  } else {
    explain.push("Bevis: ingen → +0.");
  }

  // Differensiering (0–28)
  const dfRatio = distinctRatio(diffs);
  if (diffs.length >= 3 && diffs.every((x) => x.length >= 12) && dfRatio >= 1) {
    raw += 28;
    explain.push(`Differensiering: ${diffs.length} tydelige, unike punkter → +28.`);
  } else if (diffs.length >= 2 && dfRatio >= 1) {
    const pts = Math.min(22, 10 + diffs.length * 3);
    raw += pts;
    explain.push(`Differensiering: ${diffs.length} punkt(er) → +${pts}.`);
  } else if (diffs.length === 1) {
    raw += 6;
    explain.push("Differensiering: ett punkt — svakt → +6.");
  } else {
    explain.push("Differensiering: mangler → +0.");
  }

  // Kryss-overlapp (trekk)
  const cross = overlapFraction(proofs, diffs);
  if (proofs.length > 0 && diffs.length > 0) {
    if (cross > 0.25) {
      const pen = Math.min(18, Math.round((cross - 0.25) * 60));
      raw -= pen;
      explain.push(`Kryss-gjentakelse bevis/differensiering ${(cross * 100).toFixed(0)} % → −${pen}.`);
    } else {
      explain.push(`Kryss-gjentakelse lav (${(cross * 100).toFixed(0)} %) → trekk 0.`);
    }
  }

  const score = clamp100(raw);
  explain.push(
    `Validering — tydelig: ${clear ? "ja" : "nei"}, unik: ${unique ? "ja" : "nei"}, gjentakbar: ${repeatable ? "ja" : "nei"}.`,
  );
  explain.push(`Total styrke: ${score}/100.`);

  return {
    score,
    explain,
    validation: { clear, unique, repeatable },
  };
}
