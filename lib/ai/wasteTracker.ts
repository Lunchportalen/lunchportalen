/**
 * Matsvinn / rest — kun fra eksplisitte tall (produsert vs konsumert).
 * Uten produksjonsregistrering returneres «ingen data» (fail-closed, forklarbar).
 */

export type WasteDayInput = {
  date: string;
  /** Faktisk produsert antall (kjøkkenregistrering). */
  produced: number | null | undefined;
  /** Faktisk solgt / utlevert / konsumert (f.eks. aktive bestillinger). */
  consumed: number | null | undefined;
};

export type WasteDayResult = {
  date: string;
  wastePercent: number | null;
  leftover: number | null;
  explain: string;
};

export type WasteRollup = {
  /** Gjennomsnittlig svinnprosent over dager med full data. */
  averageWastePercent: number | null;
  daysWithData: number;
  daysMissingProduction: number;
  transparencyNote: string;
};

const NOTE = "Basert på historiske bestillinger og registrert produksjon der tilgjengelig";

function safeNum(n: unknown): number | null {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return null;
  return x;
}

/**
 * Svinn % = max(0, produsert − konsumert) / produsert
 */
export function wastePercentForDay(input: WasteDayInput): WasteDayResult {
  const date = String(input.date ?? "").trim();
  const produced = safeNum(input.produced);
  const consumed = safeNum(input.consumed);

  if (produced == null) {
    return {
      date,
      wastePercent: null,
      leftover: null,
      explain: "Ingen registrert produksjon — svinn kan ikke beregnes.",
    };
  }
  if (consumed == null) {
    return {
      date,
      wastePercent: null,
      leftover: null,
      explain: "Mangler konsumert antall — svinn kan ikke beregnes.",
    };
  }

  const leftover = Math.max(0, produced - consumed);
  const wastePercent = produced > 0 ? leftover / produced : 0;

  return {
    date,
    wastePercent,
    leftover,
    explain:
      leftover <= 0
        ? "Ingen overskudd registrert (konsum ≥ produsert)."
        : `Overskudd ${leftover} av ${produced} (${(wastePercent * 100).toFixed(1)} %).`,
  };
}

export function rollupWasteMetrics(days: WasteDayInput[]): WasteRollup {
  let sumPct = 0;
  let n = 0;
  let missing = 0;

  for (const d of days) {
    const r = wastePercentForDay(d);
    if (r.wastePercent == null) {
      missing += 1;
      continue;
    }
    sumPct += r.wastePercent;
    n += 1;
  }

  return {
    averageWastePercent: n > 0 ? sumPct / n : null,
    daysWithData: n,
    daysMissingProduction: missing,
    transparencyNote: NOTE,
  };
}
