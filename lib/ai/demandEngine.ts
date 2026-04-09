/**
 * Etterspørselsprognose V1 — deterministisk, forklarbar, uten ML.
 * Grensesnittet (input/output) er stabilt for senere utskifting (f.eks. LSTM / tidsserie) uten å endre API-kontrakter.
 */

import { addDaysISO } from "@/lib/date/oslo";
import type { WeekdayKeyMonFri } from "@/lib/date/weekdayKeyFromIso";
import { weekdayKeyFromOsloISODate } from "@/lib/date/weekdayKeyFromIso";
import type { DailyDemandAgg } from "@/lib/ai/demandData";

export type DemandForecastInput = {
  /** Dato vi skal prognostisere (YYYY-MM-DD, Europe/Oslo kalenderdag). */
  targetDate: string;
  /** Historikk: én rad per leveringsdag med faktiske tall. */
  history: DailyDemandAgg[];
  /**
   * Ukedager med levering (man–fre). Tom = alle virkedager.
   */
  deliveryWeekdays?: ReadonlySet<WeekdayKeyMonFri>;
  /** Valgfritt: antall ansatte (kun til forklarende tekst / tak, ikke brukt til å oppjustere uten data). */
  companyEmployeeCount?: number | null;
};

export type DemandForecastOutput = {
  date: string;
  predictedOrders: number;
  confidence: number;
  /** Sikkerhetsbuffer 5–10 % avhengig av spredning (unngå underproduksjon). */
  bufferPercent: number;
  /** Anbefalt planlagt volum = ceil(predicted * (1 + buffer)). */
  plannedWithBuffer: number;
  /** Symmetrisk usikkerhetsbånd rundt prediksjon (porsjoner). */
  marginOfError: number;
  cancellationRateApplied: number;
  trendAdjustment: number;
  baseAverage: number;
  sampleSize: number;
  explanation: string[];
  transparencyNote: string;
};

const TRANSPARENCY = "Basert på historiske bestillinger";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stddev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const v = mean(nums.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function isWeekendOslo(iso: string): boolean {
  const d = new Date(`${iso}T12:00:00+01:00`);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

/**
 * V1-modell:
 * grunnlag = snitt av inntil 4 siste like ukedager (aktive bestillinger)
 * + dempet trend (siste 2 vs forrige 2)
 * − reduksjon proporsjonal med historisk avbestillingsrate før cut-off
 */
export function forecastDemandV1(input: DemandForecastInput): DemandForecastOutput {
  const target = String(input.targetDate ?? "").trim();
  const explanation: string[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    return {
      date: target,
      predictedOrders: 0,
      confidence: 0,
      bufferPercent: 10,
      plannedWithBuffer: 0,
      marginOfError: 0,
      cancellationRateApplied: 0,
      trendAdjustment: 0,
      baseAverage: 0,
      sampleSize: 0,
      explanation: ["Ugyldig dato — ingen prognose."],
      transparencyNote: TRANSPARENCY,
    };
  }

  if (isWeekendOslo(target)) {
    return {
      date: target,
      predictedOrders: 0,
      confidence: 0.25,
      bufferPercent: 5,
      plannedWithBuffer: 0,
      marginOfError: 0,
      cancellationRateApplied: 0,
      trendAdjustment: 0,
      baseAverage: 0,
      sampleSize: 0,
      explanation: ["Helg — ingen leveringsprognose (forventet 0)."],
      transparencyNote: TRANSPARENCY,
    };
  }

  const targetKey = weekdayKeyFromOsloISODate(target);
  const delivery =
    input.deliveryWeekdays && input.deliveryWeekdays.size > 0
      ? input.deliveryWeekdays
      : (new Set(["mon", "tue", "wed", "thu", "fri"]) as Set<WeekdayKeyMonFri>);

  if (targetKey && !delivery.has(targetKey)) {
    return {
      date: target,
      predictedOrders: 0,
      confidence: 0.35,
      bufferPercent: 5,
      plannedWithBuffer: 0,
      marginOfError: 0,
      cancellationRateApplied: 0,
      trendAdjustment: 0,
      baseAverage: 0,
      sampleSize: 0,
      explanation: ["Dagen er ikke i leveringsplanen — prognose satt til 0."],
      transparencyNote: TRANSPARENCY,
    };
  }

  const byDate = new Map(input.history.map((h) => [h.date, h]));
  const sameWeekday: DailyDemandAgg[] = [];

  for (let i = 1; i <= 120; i++) {
    const d = addDaysISO(target, -7 * i);
    const row = byDate.get(d);
    if (!row) continue;
    const k = weekdayKeyFromOsloISODate(d);
    if (k !== targetKey) continue;
    sameWeekday.push(row);
    if (sameWeekday.length >= 8) break;
  }

  const last4 = sameWeekday.slice(0, 4).map((r) => r.activeCount);
  const sampleSize = last4.length;
  const baseAverage = sampleSize > 0 ? mean(last4) : 0;

  let trendAdjustment = 0;
  if (sameWeekday.length >= 4) {
    const recent = mean(sameWeekday.slice(0, 2).map((r) => r.activeCount));
    const older = mean(sameWeekday.slice(2, 4).map((r) => r.activeCount));
    trendAdjustment = (recent - older) * 0.35;
    explanation.push(
      `Trendjustering: ${trendAdjustment >= 0 ? "+" : ""}${trendAdjustment.toFixed(2)} porsjoner (dempet sammenligning siste to vs. forrige to like ukedager).`,
    );
  } else {
    explanation.push("For få historiske punkter til trend — kun snitt brukt.");
  }

  let sumCancelBefore = 0;
  let sumRows = 0;
  for (const h of input.history) {
    sumCancelBefore += h.cancelledBeforeCutoff;
    sumRows += h.totalRows;
  }
  const cancellationRateApplied =
    sumRows > 0 ? clamp(sumCancelBefore / Math.max(1, sumRows), 0, 0.95) : 0;

  let predicted = baseAverage + trendAdjustment - baseAverage * cancellationRateApplied;
  predicted = Math.max(0, Math.round(predicted));

  explanation.push(
    `Snitt av inntil 4 siste like ukedager (aktive bestillinger): ${baseAverage.toFixed(2)} porsjoner.`,
  );
  explanation.push(
    `Historisk avbestilling før kl. 08:00: ${(cancellationRateApplied * 100).toFixed(1)} % av ordre-rader i historikk-vinduet.`,
  );

  const sigma = sampleSize >= 2 ? stddev(last4) : baseAverage * 0.15;
  const coefVar = baseAverage > 0 ? sigma / baseAverage : 1;
  const bufferPercent = clamp(5 + Math.min(5, coefVar * 12), 5, 10);

  const plannedWithBuffer = Math.ceil(predicted * (1 + bufferPercent / 100));
  const marginOfError = Math.max(1, Math.round(predicted * (bufferPercent / 100)));

  let confidence = 0.25 + 0.18 * Math.min(sampleSize, 4) - 0.12 * clamp(coefVar, 0, 1.5);
  if (sampleSize === 0) confidence = 0.2;
  confidence = clamp(confidence, 0.15, 0.92);

  explanation.push(
    `Sikkerhetsbuffer ${bufferPercent.toFixed(0)} % (fra spredning) — planlagt tak ${plannedWithBuffer} porsjoner for å redusere underproduksjon.`,
  );

  if (input.companyEmployeeCount != null && input.companyEmployeeCount > 0) {
    explanation.push(
      `Referanse: ${input.companyEmployeeCount} aktive ansatte i scope (påvirker ikke tall uten historikk).`,
    );
  }

  return {
    date: target,
    predictedOrders: predicted,
    confidence,
    bufferPercent,
    plannedWithBuffer,
    marginOfError,
    cancellationRateApplied,
    trendAdjustment,
    baseAverage,
    sampleSize,
    explanation,
    transparencyNote: TRANSPARENCY,
  };
}

/**
 * Sammenlign prediksjon lagret «i går» med faktisk — kun matematikk (persistens skjer i kallet).
 */
export function forecastError(predicted: number, actualActive: number): number {
  return actualActive - predicted;
}
