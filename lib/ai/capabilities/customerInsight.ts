/**
 * AI Customer Insight capability: generateInsightReport.
 * AI lager automatiske innsiktsrapporter: mest populære retter, endringer i preferanser, sesongmønstre.
 * Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "customerInsight";

const customerInsightCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Customer insight: generates automatic insight reports—most popular dishes, preference changes, seasonal patterns. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Customer insight input",
    properties: {
      dishOrdersCurrent: {
        type: "array",
        description: "Dish order counts for current period",
        items: { type: "object", properties: { dishId: { type: "string" }, title: { type: "string" }, count: { type: "number" } } },
      },
      dishOrdersPrevious: {
        type: "array",
        description: "Optional: previous period for preference change",
        items: { type: "object", properties: { dishId: { type: "string" }, title: { type: "string" }, count: { type: "number" } } },
      },
      ordersBySeason: {
        type: "array",
        description: "Optional: dishes per season for seasonal patterns",
        items: {
          type: "object",
          properties: {
            season: { type: "string" },
            dishes: { type: "array", items: { type: "object", properties: { dishId: { type: "string" }, title: { type: "string" }, count: { type: "number" } } } },
          },
        },
      },
      periodLabel: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["dishOrdersCurrent"],
  },
  outputSchema: {
    type: "object",
    description: "Insight report",
    required: ["mostPopularDishes", "preferenceChanges", "seasonalPatterns", "reportSummary", "generatedAt"],
    properties: {
      mostPopularDishes: { type: "array", items: { type: "object" } },
      preferenceChanges: { type: "array", items: { type: "object" } },
      seasonalPatterns: { type: "array", items: { type: "object" } },
      reportSummary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "analytics_only",
      description: "Output is insight report only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(customerInsightCapability);

export type DishOrderEntry = {
  dishId?: string | null;
  title?: string | null;
  count: number;
};

export type SeasonOrdersInput = {
  season: string;
  dishes: DishOrderEntry[];
};

export type CustomerInsightInput = {
  dishOrdersCurrent: DishOrderEntry[];
  dishOrdersPrevious?: DishOrderEntry[] | null;
  ordersBySeason?: SeasonOrdersInput[] | null;
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type PopularDishItem = {
  rank: number;
  dishId: string | null;
  title: string;
  count: number;
  sharePercent: number;
};

export type PreferenceChangeItem = {
  dishId: string | null;
  title: string;
  trend: "rising" | "falling" | "stable";
  changePercent: number;
  currentCount: number;
  previousCount: number;
  insight: string;
};

export type SeasonalPatternItem = {
  season: string;
  topDishes: { title: string; count: number }[];
  insight: string;
};

export type CustomerInsightOutput = {
  mostPopularDishes: PopularDishItem[];
  preferenceChanges: PreferenceChangeItem[];
  seasonalPatterns: SeasonalPatternItem[];
  reportSummary: string;
  generatedAt: string;
};

const TOP_N = 10;
const MIN_CHANGE_PERCENT = 5;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Generates automatic customer insight report: popular dishes, preference changes, seasonal patterns. Deterministic.
 */
export function generateInsightReport(input: CustomerInsightInput): CustomerInsightOutput {
  const isEn = input.locale === "en";
  const current = Array.isArray(input.dishOrdersCurrent) ? input.dishOrdersCurrent : [];
  const previous = Array.isArray(input.dishOrdersPrevious) ? input.dishOrdersPrevious : [];
  const bySeason = Array.isArray(input.ordersBySeason) ? input.ordersBySeason : [];
  const periodLabel = safeStr(input.periodLabel) || (isEn ? "current period" : "nåværende periode");

  const byTitleCurrent = new Map<string, { dishId: string | null; count: number }>();
  for (const d of current) {
    const title = safeStr(d.title || d.dishId) || "unknown";
    if (title === "unknown") continue;
    const dishId = safeStr(d.dishId) || null;
    const existing = byTitleCurrent.get(title);
    const count = (existing?.count ?? 0) + safeNum(d.count);
    byTitleCurrent.set(title, { dishId, count });
  }
  const totalCurrent = [...byTitleCurrent.values()].reduce((s, x) => s + x.count, 0);

  const mostPopularDishes: PopularDishItem[] = [...byTitleCurrent.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TOP_N)
    .map(([title, { dishId, count }], i) => ({
      rank: i + 1,
      dishId,
      title,
      count,
      sharePercent: totalCurrent > 0 ? Math.round((count / totalCurrent) * 1000) / 10 : 0,
    }));

  const byTitlePrevious = new Map<string, number>();
  for (const d of previous) {
    const title = safeStr(d.title || d.dishId) || "unknown";
    if (title === "unknown") continue;
    byTitlePrevious.set(title, (byTitlePrevious.get(title) ?? 0) + safeNum(d.count));
  }

  const preferenceChanges: PreferenceChangeItem[] = [];
  const allTitles = new Set([...byTitleCurrent.keys(), ...byTitlePrevious.keys()]);
  for (const title of allTitles) {
    const curr = byTitleCurrent.get(title)?.count ?? 0;
    const prev = byTitlePrevious.get(title) ?? 0;
    const dishId = byTitleCurrent.get(title)?.dishId ?? null;
    if (prev === 0 && curr === 0) continue;
    const changePercent = prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : (curr > 0 ? 100 : 0);
    const trend: "rising" | "falling" | "stable" =
      changePercent >= MIN_CHANGE_PERCENT ? "rising" : changePercent <= -MIN_CHANGE_PERCENT ? "falling" : "stable";
    if (trend === "stable" && prev === 0 && curr === 0) continue;
    const insight =
      trend === "rising"
        ? isEn
          ? `Growing preference for «${title}».`
          : `Økende preferanse for «${title}».`
        : trend === "falling"
          ? isEn
            ? `Declining preference for «${title}».`
            : `Synkende preferanse for «${title}».`
          : isEn
            ? `Stable preference for «${title}».`
            : `Stabil preferanse for «${title}».`;
    preferenceChanges.push({
      dishId,
      title,
      trend,
      changePercent,
      currentCount: curr,
      previousCount: prev,
      insight,
    });
  }
  preferenceChanges.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  const seasonalPatterns: SeasonalPatternItem[] = bySeason.map((s) => {
    const dishes = Array.isArray(s.dishes) ? s.dishes : [];
    const byTitle = new Map<string, number>();
    for (const d of dishes) {
      const title = safeStr(d.title || d.dishId) || "unknown";
      if (title === "unknown") continue;
      byTitle.set(title, (byTitle.get(title) ?? 0) + safeNum(d.count));
    }
    const topDishes = [...byTitle.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => ({ title, count }));
    const seasonLabel = safeStr(s.season) || "—";
    const insight = isEn
      ? `In ${seasonLabel}: top choices are ${topDishes.map((x) => x.title).join(", ") || "—"}.`
      : `I ${seasonLabel}: toppvalg er ${topDishes.map((x) => x.title).join(", ") || "—"}.`;
    return { season: seasonLabel, topDishes, insight };
  });

  const reportSummary = isEn
    ? `Customer insight report for ${periodLabel}: ${mostPopularDishes.length} most popular dishes, ${preferenceChanges.filter((p) => p.trend !== "stable").length} preference change(s), ${seasonalPatterns.length} seasonal pattern(s).`
    : `Kundeinnsiktsrapport for ${periodLabel}: ${mostPopularDishes.length} mest populære retter, ${preferenceChanges.filter((p) => p.trend !== "stable").length} endring(er) i preferanser, ${seasonalPatterns.length} sesongmønster.`;

  return {
    mostPopularDishes,
    preferenceChanges,
    seasonalPatterns,
    reportSummary,
    generatedAt: new Date().toISOString(),
  };
}
