/**
 * Tilbakemeldingssløyfe uten persistert modell: sammenlign motfaktisk med hva V1-modellen
 * ville sagt med historikk *før* den dagen (deterministisk «hindcasting»).
 */

import type { DailyDemandAgg } from "@/lib/ai/demandData";
import { forecastDemandV1 } from "@/lib/ai/demandEngine";
import type { WeekdayKeyMonFri } from "@/lib/date/weekdayKeyFromIso";

export type HindcastResult = {
  evaluationDate: string;
  hindcastPredicted: number;
  actualActive: number;
  error: number;
  explain: string[];
};

export function hindcastLastDeliveryDay(opts: {
  /** Siste fullførte leveringsdag vi vil evaluere (YYYY-MM-DD). */
  evaluationDate: string;
  /** Alle dagaggregater; brukes med filtrering. */
  history: DailyDemandAgg[];
  deliveryWeekdays?: ReadonlySet<WeekdayKeyMonFri>;
}): HindcastResult | null {
  const evalD = String(opts.evaluationDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(evalD)) return null;

  const prior = opts.history.filter((h) => h.date < evalD);
  if (prior.length < 2) {
    return {
      evaluationDate: evalD,
      hindcastPredicted: 0,
      actualActive: opts.history.find((h) => h.date === evalD)?.activeCount ?? 0,
      error: 0,
      explain: ["For lite historikk før valgt dato til hindcast — viser kun faktisk volum."],
    };
  }

  const fc = forecastDemandV1({
    targetDate: evalD,
    history: prior,
    deliveryWeekdays: opts.deliveryWeekdays,
  });

  const actual = opts.history.find((h) => h.date === evalD)?.activeCount ?? 0;
  const err = actual - fc.predictedOrders;

  return {
    evaluationDate: evalD,
    hindcastPredicted: fc.predictedOrders,
    actualActive: actual,
    error: err,
    explain: [
      `Hindcast: med data kun før ${evalD} ville V1-modellen sagt ${fc.predictedOrders} aktive; faktisk ble ${actual}.`,
      `Avvik: ${err >= 0 ? "+" : ""}${err} porsjoner. Neste prognose inkluderer allerede faktisk utfall i historikk.`,
    ],
  };
}
