/**
 * AI Demand Forecast capability: runDemandForecast.
 * Predikerer hvor mange lunsjer som trengs.
 * Data: historiske bestillinger, ukedag, ferie, vær, kontorstørrelse.
 * Resultat: produksjonsprognose. Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "demandForecast";

const demandForecastCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Demand forecast: predicts how many lunches are needed. Inputs: historical orders, weekday, holidays, weather, office size. Output: production forecast. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Demand forecast input",
    properties: {
      historicalOrders: {
        type: "array",
        description: "Historical orders by date/weekday (and optional slot)",
        items: {
          type: "object",
          properties: {
            date: { type: "string", description: "ISO date" },
            dayOfWeek: { type: "number", description: "0=Sun..6=Sat or 1=Mon..7=Sun" },
            slotId: { type: "string" },
            ordersCount: { type: "number" },
          },
        },
      },
      forecastFrom: { type: "string", description: "ISO date" },
      forecastTo: { type: "string", description: "ISO date" },
      holidays: {
        type: "array",
        items: { type: "string" },
        description: "ISO dates that are holidays (reduced demand)",
      },
      weatherHint: {
        type: "string",
        enum: ["varmt", "kaldt", "regn", "neutral"],
        description: "Optional weather for period",
      },
      officeSize: { type: "number", description: "Kontorstørrelse (antall ansatte); brukes til skalering" },
      localEvents: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string" },
            label: { type: "string" },
            impact: { type: "string", enum: ["higher", "lower", "neutral"] },
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["historicalOrders", "forecastFrom", "forecastTo"],
  },
  outputSchema: {
    type: "object",
    description: "Demand forecast output — produksjonsprognose",
    required: ["forecasts", "productionForecast", "summary", "generatedAt"],
    properties: {
      forecasts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string" },
            dayLabel: { type: "string" },
            slotId: { type: "string" },
            estimatedOrders: { type: "number" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            rationale: { type: "string" },
          },
        },
      },
      productionForecast: {
        type: "object",
        description: "Produksjonsprognose: totalt antall lunsjer og per dag",
        properties: {
          totalLunches: { type: "number" },
          byDay: { type: "array", items: { type: "object" } },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "forecast_only",
      description: "Output is forecast only; no orders or system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "kitchen"],
};

registerCapability(demandForecastCapability);

export type HistoricalOrderRow = {
  date?: string | null;
  dayOfWeek?: number | null;
  slotId?: string | null;
  ordersCount: number;
};

export type LocalEventInput = {
  date: string;
  label?: string | null;
  impact: "higher" | "lower" | "neutral";
};

export type DemandForecastInput = {
  historicalOrders: HistoricalOrderRow[];
  forecastFrom: string;
  forecastTo: string;
  holidays?: string[] | null;
  weatherHint?: "varmt" | "kaldt" | "regn" | "neutral" | null;
  /** Kontorstørrelse (antall ansatte); brukes til skalering av prognose når historikk er fra annen størrelse. */
  officeSize?: number | null;
  localEvents?: LocalEventInput[] | null;
  locale?: "nb" | "en" | null;
};

export type DemandForecastDay = {
  date: string;
  dayLabel: string;
  slotId?: string | null;
  estimatedOrders: number;
  confidence: "high" | "medium" | "low";
  rationale: string;
};

/** Produksjonsprognose: hvor mange lunsjer som trengs totalt og per dag. */
export type ProductionForecast = {
  totalLunches: number;
  byDay: { date: string; dayLabel: string; estimatedOrders: number }[];
};

export type DemandForecastOutput = {
  forecasts: DemandForecastDay[];
  /** Resultat: produksjonsprognose for kjøkkenet. */
  productionForecast: ProductionForecast;
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseISODate(s: string): Date | null {
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDayOfWeek(d: Date): number {
  return d.getDay();
}

const DAY_LABELS_NB = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
const DAY_LABELS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Runs demand forecast: estimates future volume from history, calendar, holidays, weather, events. Deterministic.
 */
export function runDemandForecast(input: DemandForecastInput): DemandForecastOutput {
  const isEn = input.locale === "en";
  const dayLabels = isEn ? DAY_LABELS_EN : DAY_LABELS_NB;
  const orders = Array.isArray(input.historicalOrders) ? input.historicalOrders : [];
  const holidays = new Set(
    Array.isArray(input.holidays) ? input.holidays.map((d) => d.slice(0, 10)) : []
  );
  const eventsByDate = new Map<string, LocalEventInput>();
  if (Array.isArray(input.localEvents)) {
    for (const e of input.localEvents) {
      const d = safeStr(e.date).slice(0, 10);
      if (d) eventsByDate.set(d, e);
    }
  }

  const from = parseISODate(input.forecastFrom.slice(0, 10));
  const to = parseISODate(input.forecastTo.slice(0, 10));
  if (!from || !to || from > to) {
    const fallback = toISODate(new Date());
    return {
      forecasts: [],
      productionForecast: { totalLunches: 0, byDay: [] },
      summary: isEn
        ? "Invalid forecast period; use forecastFrom and forecastTo as ISO dates."
        : "Ugyldig prognoseperiode; bruk forecastFrom og forecastTo som ISO-datoer.",
      generatedAt: new Date().toISOString(),
    };
  }

  /** Skalering fra kontorstørrelse: officeSize / 50, begrenset til 0.5–2. */
  const officeSize = safeNum(input.officeSize);
  const sizeScale =
    officeSize > 0 ? Math.min(2, Math.max(0.5, officeSize / 50)) : 1;

  const byWeekday = new Map<number, { total: number; n: number }>();
  for (const row of orders) {
    const count = safeNum(row.ordersCount);
    if (count <= 0) continue;
    const dow = row.dayOfWeek ?? (row.date ? getDayOfWeek(new Date(row.date)) : 0);
    const cur = byWeekday.get(dow) ?? { total: 0, n: 0 };
    byWeekday.set(dow, { total: cur.total + count, n: cur.n + 1 });
  }

  const avgByWeekday = new Map<number, number>();
  for (const [dow, { total, n }] of byWeekday) {
    avgByWeekday.set(dow, n > 0 ? Math.round(total / n) : 0);
  }
  const globalAvg =
    orders.length > 0
      ? Math.round(
          orders.reduce((s, r) => s + safeNum(r.ordersCount), 0) / Math.max(1, orders.length)
        )
      : 0;
  const baselineAvg =
    avgByWeekday.size > 0
      ? Math.round(
          [...avgByWeekday.values()].reduce((s, v) => s + v, 0) / avgByWeekday.size
        )
      : globalAvg;

  const forecasts: DemandForecastDay[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= to) {
    const dateStr = toISODate(cursor);
    const dow = getDayOfWeek(cursor);
    const dayLabel = dayLabels[dow] ?? `Day ${dow}`;
    const isHoliday = holidays.has(dateStr);
    const event = eventsByDate.get(dateStr);

    let estimated = (avgByWeekday.get(dow) ?? baselineAvg ?? globalAvg) * sizeScale;
    estimated = Math.round(estimated);
    const factors: string[] = [];

    if (isHoliday) {
      estimated = Math.round(estimated * 0.3);
      factors.push(isEn ? "holiday (reduced)" : "ferie (redusert)");
    }
    if (event?.impact === "lower") {
      estimated = Math.round(estimated * 0.7);
      factors.push(isEn ? `event: ${event.label ?? "lower demand"}` : `hendelse: ${event.label ?? "lavere etterspørsel"}`);
    } else if (event?.impact === "higher") {
      estimated = Math.round(estimated * 1.2);
      factors.push(isEn ? `event: ${event.label ?? "higher demand"}` : `hendelse: ${event.label ?? "høyere etterspørsel"}`);
    }
    if (input.weatherHint === "regn" && factors.length === 0) {
      estimated = Math.round(estimated * 1.05);
      factors.push(isEn ? "rain (slight increase)" : "regn (liten økning)");
    }

    const hasHistory = avgByWeekday.has(dow);
    const confidence: "high" | "medium" | "low" =
      hasHistory && orders.length >= 14 ? "high" : orders.length >= 5 ? "medium" : "low";
    const rationale =
      factors.length > 0
        ? factors.join(". ")
        : hasHistory
          ? isEn
            ? "Based on weekday history."
            : "Basert på ukedagshistorikk."
          : isEn
            ? "Based on overall average (limited history for this weekday)."
            : "Basert på snitt (begrenset historikk for denne ukedagen).";

    forecasts.push({
      date: dateStr,
      dayLabel,
      estimatedOrders: Math.max(0, estimated),
      confidence,
      rationale,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalEst = forecasts.reduce((s, f) => s + f.estimatedOrders, 0);
  const productionForecast: ProductionForecast = {
    totalLunches: totalEst,
    byDay: forecasts.map((f) => ({
      date: f.date,
      dayLabel: f.dayLabel,
      estimatedOrders: f.estimatedOrders,
    })),
  };
  const summary =
    isEn
      ? `Production forecast: ${forecasts.length} days, ${totalEst} lunches needed. Use for kitchen planning.`
      : `Produksjonsprognose: ${forecasts.length} dager, ${totalEst} lunsjer trengs. Bruk til kjøkkenplanlegging.`;

  return {
    forecasts,
    productionForecast,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
