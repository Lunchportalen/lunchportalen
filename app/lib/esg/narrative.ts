function fmtNok(n: any) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(v);
}
function fmtNum(n: any, digits = 0) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: digits }).format(v);
}
function pct(delta: number | null) {
  if (delta === null) return null;
  return `${fmtNum(delta * 100, 1)} %`;
}

function safeRate(ordered: number, wasteMeals: number) {
  if (!ordered || ordered <= 0) return null;
  return wasteMeals / ordered;
}

export function buildEsgNarrativeYear(args: { current: any; previous: any | null; year: number }) {
  const c = args.current;
  const p = args.previous;

  const ordered = Number(c.ordered_count ?? 0);
  const saved = Number(c.cost_saved_nok ?? 0);
  const wasteKg = Number(c.waste_kg ?? 0);
  const co2e = Number(c.waste_co2e_kg ?? 0);
  const score = (c.stability_score ?? "—").toString();

  const wasteRate = safeRate(ordered, Number(c.waste_meals ?? 0));

  let wasteRateDelta: number | null = null;
  let savedDelta: number | null = null;

  if (p) {
    const pOrdered = Number(p.ordered_count ?? 0);
    const pWasteRate = safeRate(pOrdered, Number(p.waste_meals ?? 0));
    if (wasteRate !== null && pWasteRate !== null && pWasteRate > 0) {
      wasteRateDelta = (wasteRate - pWasteRate) / pWasteRate; // relativ endring
    }
    const pSaved = Number(p.cost_saved_nok ?? 0);
    if (pSaved > 0) savedDelta = (saved - pSaved) / pSaved;
  }

  const lines: string[] = [];

  // 1) Tydelig faktalinje
  lines.push(`År ${args.year}: ${fmtNum(ordered)} bestillinger. Spart ${fmtNok(saved)} via avbestilling i tide. Stabilitet ${score}.`);

  // 2) Matsvinn (faktabasert)
  lines.push(`Dokumentert matsvinn: ${fmtNum(wasteKg, 1)} kg (${fmtNum(co2e, 1)} kg CO₂e).`);

  // 3) Svinnrate
  if (wasteRate !== null) lines.push(`Svinnrate: ${fmtNum(wasteRate * 100, 1)} %.`);

  // 4) Endring vs i fjor (hvis mulig)
  if (wasteRateDelta !== null) {
    const direction = wasteRateDelta < 0 ? "lavere" : "høyere";
    lines.push(`Svinnraten er ${direction} enn i fjor med ${pct(Math.abs(wasteRateDelta))}.`);
  }
  if (savedDelta !== null) {
    const direction = savedDelta < 0 ? "lavere" : "høyere";
    lines.push(`Sparte kostnader er ${direction} enn i fjor med ${pct(Math.abs(savedDelta))}.`);
  }

  // 5) Revisjonssetning (fast)
  lines.push("Tallene er snapshot-basert og beregnet fra faktiske bestillinger/avbestillinger (cut-off 08:00 Europe/Oslo).");

  return { lines };
}
