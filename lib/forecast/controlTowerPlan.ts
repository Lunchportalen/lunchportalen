/**
 * Sammenslår forecast, trend, ukedag, lager og meny for kontrolltårn (deterministisk, forklarbar).
 */

import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import type { CalendarPost } from "@/lib/social/calendar";
import { groupByProduct, type SalesPoint } from "@/lib/forecast/data";
import { forecastUnits } from "@/lib/forecast/forecast";
import { safetyStock, type Stock } from "@/lib/forecast/inventory";
import { suggestPurchaseCapped } from "@/lib/forecast/purchase";
import { trend, weekdayLift, type TrendResult } from "@/lib/forecast/trends";
import { salesPointsFromCalendarPosts } from "@/lib/forecast/fromCalendarPosts";
import { calculateMargin, calculateProfitPerUnit, hasValidProductEconomics } from "@/lib/product/economics";
import { socialRefToProductEconomics } from "@/lib/product/socialRefEconomics";
import { buildMenu, type ProductMenuInput, type ProductScore } from "@/lib/menu/optimizer";

const DEFAULT_LEAD_DAYS = 2;
const DEFAULT_WASTE = 0.08;
const MENU_HORIZON_DAYS = 7;
const PURCHASE_CONFIDENCE_MAX_UNITS = 500;

export type WeekdayLiftEntry = { weekday: number; label: string; multiplier: number };

export type DemandMenuProductRow = {
  productId: string;
  name: string;
  forecastPerDay: number;
  confidence: number;
  trend: TrendResult;
  trendArrow: string;
  weekdayLift: WeekdayLiftEntry[];
  safetyUnits: number;
  suggestedPurchase: { suggestedUnits: number; note: string };
  onHand: number;
  leadDays: number;
  wasteFactor: number;
  margin: number;
  profitPerUnit: number;
  dataPoints: number;
  insufficientData: boolean;
};

export type DemandMenuPlan = {
  ok: boolean;
  message: string;
  horizonDays: number;
  products: DemandMenuProductRow[];
  weeklyMenu: ProductScore[];
  totalSalesPoints: number;
};

const WEEKDAY_NB = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];

function trendArrow(t: TrendResult): string {
  if (t.dir === "up") return "↑";
  if (t.dir === "down") return "↓";
  return "→";
}

function stockFromRef(ref: SocialProductRef): Stock {
  const onHand =
    typeof ref.stock === "number" && Number.isFinite(ref.stock) ? Math.max(0, Math.floor(ref.stock)) : 0;
  return {
    productId: ref.id,
    onHand,
    leadDays: DEFAULT_LEAD_DAYS,
    wasteFactor: DEFAULT_WASTE,
  };
}

function buildPlanFromGrouped(
  byProduct: Map<string, SalesPoint[]>,
  totalSalesPoints: number,
  catalog: SocialProductRef[],
  horizonDays: number,
  menuMaxItems: number,
  okMessage: string,
): DemandMenuPlan {
  const list = Array.isArray(catalog) ? catalog : [];
  const menuInputs: ProductMenuInput[] = [];
  const productRows: DemandMenuProductRow[] = [];

  for (const ref of list) {
    const name = String(ref.name ?? "").trim() || ref.id;
    const series = byProduct.get(ref.id) ?? [];
    const fc = forecastUnits(series, 7);
    const tr = trend(series);
    const liftMap = weekdayLift(series);
    const weekdayLiftArr: WeekdayLiftEntry[] = [...liftMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([w, m]) => ({
        weekday: w,
        label: WEEKDAY_NB[w] ?? String(w),
        multiplier: Number.isFinite(m) ? Math.round(m * 1000) / 1000 : 1,
      }));

    const econ = socialRefToProductEconomics(ref);
    const margin = econ && hasValidProductEconomics(econ) ? calculateMargin(econ) : 0;
    const profitPerUnit = econ && hasValidProductEconomics(econ) ? calculateProfitPerUnit(econ) : 0;
    const stock = stockFromRef(ref);

    const safetyUnits = safetyStock(fc.forecastPerDay, stock.leadDays, 1.25);
    const purchase = suggestPurchaseCapped({
      forecastPerDay: fc.forecastPerDay,
      horizonDays,
      stock: {
        onHand: stock.onHand,
        leadDays: stock.leadDays,
        wasteFactor: stock.wasteFactor,
      },
      confidence: fc.confidence,
      maxSuggestedUnits: PURCHASE_CONFIDENCE_MAX_UNITS,
    });

    const insufficientData = series.length < 3;

    productRows.push({
      productId: ref.id,
      name,
      forecastPerDay: fc.forecastPerDay,
      confidence: fc.confidence,
      trend: tr,
      trendArrow: trendArrow(tr),
      weekdayLift: weekdayLiftArr,
      safetyUnits,
      suggestedPurchase: purchase,
      onHand: stock.onHand,
      leadDays: stock.leadDays,
      wasteFactor: stock.wasteFactor ?? DEFAULT_WASTE,
      margin,
      profitPerUnit,
      dataPoints: series.length,
      insufficientData,
    });

    if (stock.onHand > 0) {
      menuInputs.push({
        productId: ref.id,
        forecast: fc.forecastPerDay,
        margin,
        profitPerUnit,
        stock: stock.onHand,
      });
    }
  }

  productRows.sort((a, b) => b.forecastPerDay - a.forecastPerDay);
  const weeklyMenu = buildMenu(menuInputs, menuMaxItems);

  return {
    ok: true,
    message: okMessage,
    horizonDays,
    products: productRows,
    weeklyMenu,
    totalSalesPoints,
  };
}

function resolveHorizon(options?: { horizonDays?: number; menuMaxItems?: number }): {
  horizonDays: number;
  menuMaxItems: number;
} {
  const horizonDays =
    typeof options?.horizonDays === "number" && Number.isFinite(options.horizonDays) && options.horizonDays > 0
      ? Math.min(30, Math.floor(options.horizonDays))
      : MENU_HORIZON_DAYS;
  const menuMaxItems =
    typeof options?.menuMaxItems === "number" && Number.isFinite(options.menuMaxItems) && options.menuMaxItems > 0
      ? Math.min(24, Math.floor(options.menuMaxItems))
      : 8;
  return { horizonDays, menuMaxItems };
}

export function buildDemandMenuPlan(
  posts: CalendarPost[],
  catalog: SocialProductRef[],
  options?: { horizonDays?: number; menuMaxItems?: number },
): DemandMenuPlan {
  const { horizonDays, menuMaxItems } = resolveHorizon(options);
  const points = salesPointsFromCalendarPosts(posts);

  if (points.length === 0) {
    return {
      ok: false,
      message:
        "Ikke nok data — publiser poster med registrerte konverterings- eller lead-felter for å bygge forecast.",
      horizonDays,
      products: [],
      weeklyMenu: [],
      totalSalesPoints: 0,
    };
  }

  const byProduct = groupByProduct(points);
  return buildPlanFromGrouped(
    byProduct,
    points.length,
    catalog,
    horizonDays,
    menuMaxItems,
    "Forecast: glidende snitt (7 dager), trend (siste 3 vs forrige 3 observasjoner), ukedagslift fra historikk. Ingen ML.",
  );
}

/** For tester eller fremtidig ordre-pipeline — samme logikk som kalender-kilden. */
export function buildDemandMenuPlanFromPoints(
  points: SalesPoint[],
  catalog: SocialProductRef[],
  options?: { horizonDays?: number; menuMaxItems?: number },
): DemandMenuPlan {
  const { horizonDays, menuMaxItems } = resolveHorizon(options);
  if (points.length === 0) {
    return {
      ok: false,
      message: "Ikke nok data",
      horizonDays,
      products: [],
      weeklyMenu: [],
      totalSalesPoints: 0,
    };
  }
  const byProduct = groupByProduct(points);
  return buildPlanFromGrouped(
    byProduct,
    points.length,
    catalog,
    horizonDays,
    menuMaxItems,
    "Forecast fra oppgitte salgspunkter (samme motor som kalender).",
  );
}
