/**
 * Bygger dag-rader for employee week API.
 * Kilde: leveringsdager + (helst) operativ tier per dag (`tierByDay` fra daymap), ellers `defaultTier` + menuDay per dato.
 */
import type { MenuDay } from "@/lib/cms/menuDay";
import { asPlanTier } from "@/lib/cms/menuDayContract";

const WEEKDAYS_NO = ["Man", "Tir", "Ons", "Tor", "Fre"] as const;
type Tier = "BASIS" | "LUXUS" | "ENTERPRISE";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
export const EMPLOYEE_WEEK_DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

export type EmployeeWeekDish = {
  title: string;
  category: string | null;
  description: string | null;
};

function menusForDate(menuByDate: Map<string, MenuDay | MenuDay[] | undefined>, date: string): MenuDay[] {
  const raw = menuByDate.get(date);
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function dishesFromMenus(menus: MenuDay[]): EmployeeWeekDish[] {
  const out: EmployeeWeekDish[] = [];
  for (const menu of menus) {
    if (menu?.isPublished !== true) continue;
    const title = String(menu.title ?? menu.mealTitle ?? "").trim();
    if (!title) continue;
    out.push({
      title,
      category: menu.category != null ? String(menu.category) : null,
      description: menu.description != null ? String(menu.description) : null,
    });
  }
  return out;
}

export type EmployeeWeekDayRow = {
  date: string;
  weekday: (typeof WEEKDAYS_NO)[number];
  dayKey: DayKey;
  tier: Tier;
  isDeliveryDay: boolean;
  dishes: EmployeeWeekDish[];
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
  menuByDate: Map<string, MenuDay | MenuDay[] | undefined>;
}): EmployeeWeekDayRow[] {
  const { dates, deliveryDayKeys, defaultTier, tierByDay, weekOffset, menuByDate } = opts;

  return dates.map((date, i) => {
    const dayKey = EMPLOYEE_WEEK_DAY_KEYS[i] ?? "mon";
    const isDeliveryDay = deliveryDayKeys.includes(dayKey);
    const menus = menusForDate(menuByDate, date);
    const primary = menus.find((m) => m?.isPublished === true) ?? menus[0];
    const desc = primary?.description != null ? String(primary.description) : null;
    const title = primary?.title != null ? String(primary.title).trim() : primary?.mealTitle != null ? String(primary.mealTitle).trim() : null;
    const allergensRaw = primary?.allergens;
    const tierRaw = tierByDay?.[dayKey] ?? defaultTier;
    const tierForDay = (asPlanTier(tierRaw) ?? defaultTier) as Tier;
    const dishes = dishesFromMenus(menus);
    return {
      date,
      weekday: WEEKDAYS_NO[i] ?? "Man",
      dayKey,
      tier: tierForDay,
      isDeliveryDay,
      dishes,
      kitchenNote: null,
      isPublished: menus.some((m) => m?.isPublished === true),
      description: desc,
      title: title || null,
      allergens: Array.isArray(allergensRaw) ? allergensRaw.map((x) => String(x)) : [],
      weekOffset,
    };
  });
}
