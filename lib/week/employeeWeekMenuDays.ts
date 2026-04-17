/**
 * Bygger dag-rader for employee week API uten Sanity weekPlan.
 * Kilde: leveringsdager + (helst) operativ tier per dag (`tierByDay` fra daymap), ellers `defaultTier` + menuContent per dato.
 */
import type { MenuContent } from "@/lib/sanity/queries";

const WEEKDAYS_NO = ["Man", "Tir", "Ons", "Tor", "Fre"] as const;
type Tier = "BASIS" | "LUXUS";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

export type EmployeeWeekDayRow = {
  date: string;
  weekday: (typeof WEEKDAYS_NO)[number];
  dayKey: DayKey;
  tier: Tier;
  isDeliveryDay: boolean;
  dishes: unknown[];
  kitchenNote: null;
  isPublished: boolean;
  description: string | null;
  title: string | null;
  allergens: string[];
  weekOffset: number;
};

export function buildEmployeeWeekDayRows(opts: {
  dates: string[];
  deliveryDayKeys: DayKey[];
  defaultTier: Tier;
  /** Når satt (operativ daymap / plan per dag), overstyrer ikke-leveringsdager også visnings-tier for konsistens. */
  tierByDay?: Partial<Record<DayKey, Tier>> | null;
  weekOffset: number;
  menuByDate: Map<string, MenuContent | undefined>;
}): EmployeeWeekDayRow[] {
  const { dates, deliveryDayKeys, defaultTier, tierByDay, weekOffset, menuByDate } = opts;

  return dates.map((date, i) => {
    const dayKey = DAY_KEYS[i] ?? "mon";
    const isDeliveryDay = deliveryDayKeys.includes(dayKey);
    const menu = menuByDate.get(date);
    const desc = menu?.description != null ? String(menu.description) : null;
    const title = menu?.title != null ? String(menu.title).trim() : null;
    const allergensRaw = menu?.allergens;
    const tierForDay = tierByDay?.[dayKey] ?? defaultTier;
    return {
      date,
      weekday: WEEKDAYS_NO[i] ?? "Man",
      dayKey,
      tier: tierForDay,
      isDeliveryDay,
      dishes: [],
      kitchenNote: null,
      isPublished: menu?.isPublished === true,
      description: desc,
      title: title || null,
      allergens: Array.isArray(allergensRaw) ? allergensRaw.map((x) => String(x)) : [],
      weekOffset,
    };
  });
}
