/**
 * Reine signaler for admin/kjøkken — ingen persistens, kun aggregering.
 */

import type { WeekdayKeyMonFri } from "@/lib/date/weekdayKeyFromIso";
import { weekdayKeyFromOsloISODate } from "@/lib/date/weekdayKeyFromIso";
import type { DailyDemandAgg } from "@/lib/ai/demandData";

const ORDER: WeekdayKeyMonFri[] = ["mon", "tue", "wed", "thu", "fri"];

const NB: Record<WeekdayKeyMonFri, string> = {
  mon: "mandag",
  tue: "tirsdag",
  wed: "onsdag",
  thu: "torsdag",
  fri: "fredag",
};

export type WeekdayAvgRow = {
  weekday: WeekdayKeyMonFri;
  label: string;
  avgActive: number;
  sampleDays: number;
};

export function weekdayActiveAverages(history: DailyDemandAgg[]): WeekdayAvgRow[] {
  const buckets: Record<WeekdayKeyMonFri, number[]> = {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
  };

  for (const h of history) {
    const k = weekdayKeyFromOsloISODate(h.date);
    if (!k) continue;
    buckets[k].push(h.activeCount);
  }

  return ORDER.map((k) => {
    const arr = buckets[k];
    const avgActive = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return {
      weekday: k,
      label: NB[k],
      avgActive,
      sampleDays: arr.length,
    };
  });
}

export type DishChoiceSignal = {
  choiceKey: string;
  count: number;
  signal: "high" | "low" | "neutral";
};

/**
 * Enkel fordeling: topp 25 % = høy, bunn 25 % = lav (minst 3 valg), etter sortert rekkefølge.
 */
export function signalsFromChoiceCounts(rows: { choice_key: string; count: number }[]): DishChoiceSignal[] {
  const list = rows.filter((r) => r.choice_key && r.count > 0).sort((a, b) => b.count - a.count);
  if (list.length === 0) return [];
  if (list.length < 3) {
    return list.map((r) => ({
      choiceKey: r.choice_key,
      count: r.count,
      signal: "neutral" as const,
    }));
  }
  const n = list.length;
  const hiCut = Math.max(1, Math.floor(n * 0.25));
  const loCut = Math.max(1, Math.floor(n * 0.25));

  return list.map((r, idx) => {
    let signal: DishChoiceSignal["signal"] = "neutral";
    if (idx < hiCut) signal = "high";
    else if (idx >= n - loCut) signal = "low";
    return { choiceKey: r.choice_key, count: r.count, signal };
  });
}

export function buildAdminSuggestionLines(
  ranked: WeekdayAvgRow[],
  dishes: DishChoiceSignal[],
): string[] {
  const lines: string[] = [];
  const withData = ranked.filter((r) => r.sampleDays > 0).sort((a, b) => b.avgActive - a.avgActive);
  if (withData.length) {
    const top = withData[0]!;
    const bottom = withData[withData.length - 1]!;
    if (top.weekday !== bottom.weekday && top.avgActive > 0) {
      lines.push(`Høyest gjennomsnittlig etterspørsel på ${top.label} (~${top.avgActive.toFixed(1)} aktive).`);
      lines.push(`Lavest gjennomsnitt på ${bottom.label} (~${bottom.avgActive.toFixed(1)} aktive).`);
    }
  }

  const badDishes = dishes.filter((d) => d.signal === "low");
  const goodDishes = dishes.filter((d) => d.signal === "high");
  for (const d of badDishes.slice(0, 3)) {
    lines.push(`Valg «${d.choiceKey}» har lavere volum i perioden — vurder meny/kommunikasjon.`);
  }
  for (const d of goodDishes.slice(0, 2)) {
    lines.push(`Valg «${d.choiceKey}» har høy etterspørsel — sikre kapasitet.`);
  }

  if (lines.length === 0) {
    lines.push("Samle mer historikk for sterkere forslag (minst noen uker med variasjon).");
  }

  return lines;
}
