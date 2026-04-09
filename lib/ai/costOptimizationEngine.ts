/**
 * Kostnadsforslag V1 — statiske enhetspriser og enkle bytteregler.
 * Output er kun «hva du kan spare» — ingen auto-endring av meny eller avtale.
 */

export type DishSignalLite = { choiceKey: string; signal: "high" | "low" | "neutral" };

const UNIT_COST_NOK_PER_PORTION: Record<string, number> = {
  lasagne: 52,
  kylling: 48,
  fisk: 55,
  risotto: 38,
  vegetar: 42,
  salat: 33,
  suppe: 28,
  pasta: 44,
  taco: 41,
  burger: 49,
  default: 45,
};

const LOW_COST_ALT: Record<string, { alt: string; cost: number; reason: string }> = {
  lasagne: { alt: "pasta", cost: 44, reason: "Lavere ingredienskost per porsjon i katalog." },
  burger: { alt: "taco", cost: 41, reason: "Enklere brød/kjøtt-mix i statisk modell." },
  fisk: { alt: "kylling", cost: 48, reason: "Kylling viser lavere enhetskost i V1-tabell." },
};

function norm(k: string) {
  return String(k ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
}

function costForKey(k: string): number {
  const n = norm(k);
  return UNIT_COST_NOK_PER_PORTION[n] ?? UNIT_COST_NOK_PER_PORTION.default!;
}

export function buildCostOptimizationLines(
  dishSignals: DishSignalLite[],
  weeklyPortionsEstimate: number,
): { lines: string[]; transparency: string[] } {
  const transparency = [
    "Kostnader er statiske eksempelverdier (NOK/porsjon) — erstatt med faktisk innkjøpspris for beslutning.",
    "Ingen endring i meny eller bestilling utføres automatisk.",
  ];

  const lines: string[] = [];
  const low = dishSignals.filter((d) => d.signal === "low");
  const w = Math.max(1, Math.floor(weeklyPortionsEstimate));

  for (const d of low.slice(0, 3)) {
    const key = norm(d.choiceKey);
    const base = costForKey(key);
    const alt = LOW_COST_ALT[key];
    if (!alt) continue;
    const altCost = alt.cost;
    const savePer = Math.max(0, base - altCost);
    const pct = base > 0 ? Math.round((savePer / base) * 100) : 0;
    const weeklySave = Math.round(savePer * (w / 5) * 0.2);
    lines.push(
      `Bytt ut «${d.choiceKey}» med «${alt.alt}» kan gi ca. ${pct} % lavere ingredienskost per porsjon i modellen (${alt.reason}).`,
    );
    if (weeklySave > 0) {
      lines.push(`Indikativ ukesbesparelse (grovt, ~20 % av volum): ca. ${weeklySave} NOK før mva.`);
    }
  }

  if (lines.length === 0) {
    lines.push("Ingen automatiske kostnadsbytteforslag akkurat nå — samle mer volumdata eller marker svake retter.");
  }

  return { lines, transparency };
}
