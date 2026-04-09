/**
 * Forslag til ukeplan — kun struktur og forklaring; endrer ikke CMS/avtale.
 */

import type { WeekdayKeyMonFri } from "@/lib/date/weekdayKeyFromIso";

const NB_DAY: Record<WeekdayKeyMonFri, string> = {
  mon: "Mandag",
  tue: "Tirsdag",
  wed: "Onsdag",
  thu: "Torsdag",
  fri: "Fredag",
};

export type WeeklyMenuSuggestion = {
  dayKey: WeekdayKeyMonFri;
  dayLabel: string;
  suggestedMain: string;
  why: string;
};

export type MenuEngineOutput = {
  week: WeeklyMenuSuggestion[];
  transparency: string[];
};

export function suggestWeeklyMenu(opts: {
  deliveryDays: WeekdayKeyMonFri[] | null;
  rankedMenuKeys: string[];
}): MenuEngineOutput {
  const transparency = [
    "Basert på popularitet (day_choices) og leveringsdager i avtale — ikke skrevet til meny-CMS.",
    "Menneske må godkjenne endringer i faktisk menytilbud.",
  ];

  const days =
    opts.deliveryDays && opts.deliveryDays.length > 0
      ? opts.deliveryDays
      : (["mon", "tue", "wed", "thu", "fri"] as WeekdayKeyMonFri[]);

  const pool = opts.rankedMenuKeys.length ? opts.rankedMenuKeys : ["standard"];
  const week: WeeklyMenuSuggestion[] = days.map((d, i) => {
    const suggestedMain = pool[i % pool.length]!;
    return {
      dayKey: d,
      dayLabel: NB_DAY[d],
      suggestedMain,
      why: `Rotasjon med vekt på rangert valg nr. ${(i % pool.length) + 1} i historikk.`,
    };
  });

  return { week, transparency };
}
