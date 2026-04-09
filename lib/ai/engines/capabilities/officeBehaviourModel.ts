// DUPLICATE — review

/**
 * AI Office Behaviour Model capability: buildOfficeBehaviourModel.
 * AI lærer hvordan hvert firma faktisk bruker systemet:
 * - hvilke dager folk spiser
 * - hvilke retter de velger
 * - hvor mange som avbestiller
 * Gir bedre prognoser og mindre matsvinn. Deterministic; no LLM.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "officeBehaviourModel";

const officeBehaviourModelCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Office behaviour model: learns how each company uses the system—which days people eat, which dishes they choose, how many cancel. Outputs day patterns, dish preferences, cancellation summary, and hints for better forecasts and less food waste. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Office behaviour model input (per company/location)",
    properties: {
      usageByDay: {
        type: "array",
        description: "Usage per weekday (0=Sunday..6=Saturday or 1=Mon..7=Sun)",
        items: {
          type: "object",
          properties: {
            dayOfWeek: { type: "number" },
            dayLabel: { type: "string" },
            ordersCount: { type: "number" },
            cancellationsCount: { type: "number" },
          },
        },
      },
      dishChoices: {
        type: "array",
        description: "Aggregated dish choice counts",
        items: {
          type: "object",
          properties: {
            dishId: { type: "string" },
            title: { type: "string" },
            count: { type: "number" },
          },
        },
      },
      periodLabel: { type: "string", description: "e.g. last 4 weeks, 2024-Q1" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["usageByDay", "dishChoices"],
  },
  outputSchema: {
    type: "object",
    description: "Office behaviour model output",
    required: [
      "dayPattern",
      "dishPreferences",
      "cancellationSummary",
      "forecastHints",
      "wasteReductionHints",
      "generatedAt",
    ],
    properties: {
      dayPattern: { type: "object" },
      dishPreferences: { type: "object" },
      cancellationSummary: { type: "object" },
      forecastHints: { type: "array", items: { type: "string" } },
      wasteReductionHints: { type: "array", items: { type: "string" } },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "read_only_analytics",
      description: "Output is analytics only; no orders or system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(officeBehaviourModelCapability);

export type UsageByDayEntry = {
  dayOfWeek: number;
  dayLabel?: string | null;
  ordersCount: number;
  cancellationsCount: number;
};

export type DishChoiceEntry = {
  dishId?: string | null;
  title?: string | null;
  count: number;
};

export type OfficeBehaviourModelInput = {
  usageByDay: UsageByDayEntry[];
  dishChoices: DishChoiceEntry[];
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type DayPattern = {
  peakDays: string[];
  quietDays: string[];
  ordersByDay: { dayLabel: string; orders: number; cancellations: number }[];
  summary: string;
};

export type DishPreferences = {
  topDishes: { title: string; count: number; sharePercent: number }[];
  totalOrders: number;
  summary: string;
};

export type CancellationSummary = {
  totalOrders: number;
  totalCancellations: number;
  cancellationRatePercent: number;
  summary: string;
};

export type OfficeBehaviourModelOutput = {
  dayPattern: DayPattern;
  dishPreferences: DishPreferences;
  cancellationSummary: CancellationSummary;
  forecastHints: string[];
  wasteReductionHints: string[];
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

/**
 * Builds office behaviour model from usage-by-day and dish choices. Deterministic.
 */
export function buildOfficeBehaviourModel(
  input: OfficeBehaviourModelInput
): OfficeBehaviourModelOutput {
  const isEn = input.locale === "en";
  const usageByDay = Array.isArray(input.usageByDay) ? input.usageByDay : [];
  const dishChoices = Array.isArray(input.dishChoices) ? input.dishChoices : [];
  const periodLabel = safeStr(input.periodLabel) || (isEn ? "the period" : "perioden");

  const ordersByDay = usageByDay.map((d) => ({
    dayLabel: safeStr(d.dayLabel) || `Day ${d.dayOfWeek}`,
    orders: safeNum(d.ordersCount),
    cancellations: safeNum(d.cancellationsCount),
  }));

  const totalOrders = ordersByDay.reduce((s, d) => s + d.orders, 0);
  const totalCancellations = ordersByDay.reduce((s, d) => s + d.cancellations, 0);
  const cancellationRatePercent =
    totalOrders > 0 ? Math.round((totalCancellations / totalOrders) * 1000) / 10 : 0;

  const withOrders = ordersByDay
    .map((d, i) => ({ ...d, index: i, dayLabel: d.dayLabel || `Dag ${i + 1}` }))
    .filter((d) => d.orders > 0)
    .sort((a, b) => b.orders - a.orders);
  const peakDays = withOrders.slice(0, 3).map((d) => d.dayLabel);
  const quietDays = ordersByDay
    .filter((d) => d.orders <= (totalOrders / 7) * 0.5)
    .map((d) => d.dayLabel);

  const dayPatternSummary =
    peakDays.length > 0
      ? isEn
        ? `Peak days: ${peakDays.join(", ")}. ${quietDays.length > 0 ? `Quieter: ${quietDays.join(", ")}.` : ""}`
        : `Hoveddager: ${peakDays.join(", ")}. ${quietDays.length > 0 ? `Roligere: ${quietDays.join(", ")}.` : ""}`
      : isEn
        ? "Insufficient data to identify day pattern."
        : "For lite data for å identifisere dagsmønster.";

  const byDish = new Map<string, number>();
  for (const c of dishChoices) {
    const title = safeStr(c.title || c.dishId) || "unknown";
    if (title === "unknown") continue;
    byDish.set(title, (byDish.get(title) ?? 0) + safeNum(c.count));
  }
  const dishTotal = Array.from(byDish.values()).reduce((s, n) => s + n, 0);
  const topDishes = [...byDish.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([title, count]) => ({
      title,
      count,
      sharePercent: dishTotal > 0 ? Math.round((count / dishTotal) * 1000) / 10 : 0,
    }));

  const dishPrefSummary =
    topDishes.length > 0
      ? isEn
        ? `Top dish: ${topDishes[0]?.title ?? ""} (${topDishes[0]?.sharePercent ?? 0}% of orders).`
        : `Mest populær: ${topDishes[0]?.title ?? ""} (${topDishes[0]?.sharePercent ?? 0} % av bestillinger).`
      : isEn
        ? "No dish data for preferences."
        : "Ingen rettdata for preferanser.";

  const cancelSummary =
    isEn
      ? `Cancellation rate: ${cancellationRatePercent}% (${totalCancellations} of ${totalOrders} orders) in ${periodLabel}.`
      : `Avbestillingsandel: ${cancellationRatePercent} % (${totalCancellations} av ${totalOrders} bestillinger) i ${periodLabel}.`;

  const forecastHints: string[] = [];
  if (peakDays.length > 0) {
    forecastHints.push(
      isEn
        ? `Plan more capacity and variety on ${peakDays.join(", ")}.`
        : `Planlegg mer kapasitet og variasjon ${peakDays.join(", ")}.`
    );
  }
  if (quietDays.length > 0) {
    forecastHints.push(
      isEn
        ? `Lower baseline forecast for ${quietDays.join(", ")} to reduce waste.`
        : `Lavere prognose for ${quietDays.join(", ")} for å redusere matsvinn.`
    );
  }
  if (topDishes.length > 0) {
    forecastHints.push(
      isEn
        ? `Prioritise "${topDishes[0]?.title ?? ""}" and similar in menu planning.`
        : `Prioriter «${topDishes[0]?.title ?? ""}» og lignende i menyplanlegging.`
    );
  }
  if (forecastHints.length === 0) {
    forecastHints.push(
      isEn ? "Add more usage data to improve forecasts." : "Legg inn mer bruksdata for bedre prognoser."
    );
  }

  const wasteReductionHints: string[] = [];
  if (cancellationRatePercent > 10) {
    wasteReductionHints.push(
      isEn
        ? `High cancellation rate (${cancellationRatePercent}%). Consider shorter order window or reminders.`
        : `Høy avbestillingsandel (${cancellationRatePercent} %). Vurder kortere bestillingsfrist eller påminnelser.`
    );
  }
  if (quietDays.length > 0) {
    wasteReductionHints.push(
      isEn
        ? `Reduce portions or options on quiet days (${quietDays.join(", ")}) to cut waste.`
        : `Reduser porsjoner eller valg på rolige dager (${quietDays.join(", ")}) for mindre matsvinn.`
    );
  }
  wasteReductionHints.push(
    isEn
      ? "Use day-by-day patterns to align production with actual demand."
      : "Bruk dagsmønster for å tilpasse produksjon til faktisk etterspørsel."
  );

  return {
    dayPattern: {
      peakDays,
      quietDays,
      ordersByDay,
      summary: dayPatternSummary,
    },
    dishPreferences: {
      topDishes,
      totalOrders: dishTotal || totalOrders,
      summary: dishPrefSummary,
    },
    cancellationSummary: {
      totalOrders,
      totalCancellations,
      cancellationRatePercent,
      summary: cancelSummary,
    },
    forecastHints,
    wasteReductionHints,
    generatedAt: new Date().toISOString(),
  };
}
