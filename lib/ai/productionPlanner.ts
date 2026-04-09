/**
 * Produksjonsplan — forenklede steg basert på volum (V1).
 * Menneskelig overstyring forventes alltid.
 */

export type ProductionStep = {
  time: string;
  task: string;
};

export type ProductionPlanOutput = {
  dateLabel: string;
  steps: ProductionStep[];
  transparency: string[];
};

export function buildProductionSchedule(opts: {
  /** YYYY-MM-DD eller fritekst. */
  targetDate: string;
  totalPortions: number;
  dominantMenus: string[];
}): ProductionPlanOutput {
  const transparency = [
    "Planen er en mal: starttid avhenger av kjøkkenkapasitet og faktisk meny.",
    "Basert på prognostisert volum og valgte menyer — ikke automatisk kjøring.",
  ];

  const n = Math.max(0, Math.floor(opts.totalPortions));
  const menus = opts.dominantMenus.length ? opts.dominantMenus.slice(0, 3).join(", ") : "standard meny";

  const steps: ProductionStep[] = [];

  if (n <= 0) {
    steps.push({ time: "—", task: "Ingen planlagt volum — avvent bestillinger." });
    return { dateLabel: opts.targetDate, steps, transparency };
  }

  const early = n >= 80 ? "05:45" : n >= 40 ? "06:00" : "06:30";
  steps.push({ time: early, task: `Forberedelse og mise en place (${n} porsjoner, vektlegger: ${menus}).` });
  steps.push({ time: "06:15", task: "Start langkok / proteiner som trenger hvile (deterministisk først i kjørelisten)." });
  steps.push({ time: "06:30", task: "Kok ris, potet eller pasta i batch — etter største volum først." });
  steps.push({ time: "07:00", task: "Sammenstilling av hovedkomponenter og oppvarming av saus." });
  steps.push({ time: "07:30", task: "Kvalitetskontroll, temperaturlogg og pakking i leveringscontainere." });
  steps.push({ time: "07:45", task: "Siste justering etter faktisk ordreliste (fasit fra Lunchportalen)." });

  return { dateLabel: opts.targetDate, steps, transparency };
}
