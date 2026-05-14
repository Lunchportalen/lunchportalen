/**
 * Single entry for date-based `menuDay` reads.
 * Mirrors the old `menuContent` reader API while projecting menuDay into the
 * existing MenuContent-shaped contract used by app/runtime callers.
 */
import "server-only";

export {
  CATEGORIES,
  CATEGORY_LABELS,
  PLAN_CATEGORIES,
  PLAN_TIERS,
  type Category,
  type PlanTier,
} from "@/lib/cms/menuDayContract";

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { sanity } from "@/lib/sanity/client";
import { menuDayHasDisplayableCopy } from "@/lib/sanity/menuDayGuards";

export type Announcement = {
  _id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
};

export type MenuItemData = {
  key: string;
  title: string;
  description?: string | null;
  allergens: string[];
  isVegetarian: boolean;
  available: boolean;
};

export type MenuDay = {
  _id: string;
  _createdAt?: string;
  _updatedAt?: string;
  date: string;
  planTier: PlanTier | null;
  category: Category | null;
  mealTitle?: string | null;
  title?: string | null;
  tier?: string | null;
  description?: string | null;
  allergens?: string[] | null;
  mayContain?: string[] | null;
  nutritionPer100g?: Record<string, unknown> | null;
  kitchenStyle?: string | null;
  costTier?: string | null;
  estimatedCostPerPortion?: number | null;
  isPublished: boolean;
  approvedForPublish?: boolean | null;
  approvedAt?: string | null;
  customerVisible?: boolean | null;
  customerVisibleSetAt?: string | null;
  items?: MenuItemData[] | null;
};

export type MenuContent = MenuDay;
export type SanityMenuDay = MenuDay;

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

const CUSTOMER_VISIBLE_FILTER = `
approvedForPublish == true &&
customerVisible == true &&
!(_id in path("drafts.**"))
`;

const MENU_DAY_PROJECTION = `
  _id,
  _createdAt,
  _updatedAt,
  date,
  planTier,
  category,
  mealTitle,
  "title": mealTitle,
  "tier": costTier,
  description,
  allergens,
  mayContain,
  nutritionPer100g,
  kitchenStyle,
  costTier,
  estimatedCostPerPortion,
  items[]{
    _key,
    "key": key.current,
    title,
    description,
    allergens,
    isVegetarian,
    available
  },
  approvedForPublish,
  approvedAt,
  customerVisible,
  customerVisibleSetAt,
  "isPublished": approvedForPublish == true && customerVisible == true
`;

export async function getActiveAnnouncement(): Promise<Announcement | null> {
  return sanity.fetch(
    `*[_type == "announcement" && active == true][0]{
      _id,
      title,
      message,
      severity
    }`,
  );
}

export async function getMenuForDate(date: string): Promise<MenuContent | null> {
  if (!isISODate(date)) {
    throw new Error(`[getMenuForDate] Invalid date (expected YYYY-MM-DD): ${date}`);
  }

  const row = await sanity.fetch<MenuContent | null>(
    `*[
      _type == "menuDay" &&
      date == $date &&
      ${CUSTOMER_VISIBLE_FILTER}
    ][0]{
      ${MENU_DAY_PROJECTION}
    }`,
    { date },
  );

  if (!row || !menuDayHasDisplayableCopy(row)) return null;
  return row;
}

export async function getPublishedMenuForDate(date: string): Promise<MenuContent | null> {
  const menu = await getMenuForDate(date);
  if (!menu || menu.isPublished !== true) return null;
  return menu;
}

export async function getMenuForDates(dates: string[]): Promise<MenuContent[]> {
  const cleaned = uniq(dates).filter(Boolean);

  if (!cleaned.length) return [];
  for (const d of cleaned) {
    if (!isISODate(d)) {
      throw new Error(`[getMenuForDates] Invalid date (expected YYYY-MM-DD): ${d}`);
    }
  }

  const rows = await sanity.fetch<MenuContent[]>(
    `*[
      _type == "menuDay" &&
      date in $dates &&
      ${CUSTOMER_VISIBLE_FILTER}
    ] | order(date asc){
      ${MENU_DAY_PROJECTION}
    }`,
    { dates: cleaned },
  );

  const list = Array.isArray(rows) ? rows : [];
  return list.filter((m) => m.isPublished === true && menuDayHasDisplayableCopy(m));
}

export async function getMenuForRange(from: string, to: string): Promise<MenuContent[]> {
  if (!isISODate(from)) {
    throw new Error(`[getMenuForRange] Invalid from-date (expected YYYY-MM-DD): ${from}`);
  }
  if (!isISODate(to)) {
    throw new Error(`[getMenuForRange] Invalid to-date (expected YYYY-MM-DD): ${to}`);
  }
  if (from > to) {
    throw new Error(`[getMenuForRange] Invalid range: from (${from}) > to (${to})`);
  }

  const rows = await sanity.fetch<MenuContent[]>(
    `*[
      _type == "menuDay" &&
      date >= $from && date <= $to &&
      ${CUSTOMER_VISIBLE_FILTER}
    ] | order(date asc){
      ${MENU_DAY_PROJECTION}
    }`,
    { from, to },
  );

  const list = Array.isArray(rows) ? rows : [];
  return list.filter((m) => m.isPublished === true && menuDayHasDisplayableCopy(m));
}

export const getMenuForDateRange = getMenuForRange;

export async function getMenuForDatesAdmin(dates: string[]): Promise<MenuContent[]> {
  const cleaned = uniq(dates).filter(Boolean);

  if (!cleaned.length) return [];
  for (const d of cleaned) {
    if (!isISODate(d)) {
      throw new Error(`[getMenuForDatesAdmin] Invalid date (expected YYYY-MM-DD): ${d}`);
    }
  }

  const rows = await sanity.fetch<MenuContent[]>(
    `*[
      _type == "menuDay" &&
      date in $dates &&
      !(_id in path("drafts.**"))
    ] | order(date asc){
      ${MENU_DAY_PROJECTION}
    }`,
    { dates: cleaned },
  );

  return Array.isArray(rows) ? rows : [];
}

export async function getMenuForDateAndPlan(date: string, planTier: PlanTier): Promise<MenuDay[]> {
  if (!isISODate(date)) {
    throw new Error(`[getMenuForDateAndPlan] Invalid date (expected YYYY-MM-DD): ${date}`);
  }

  const rows = await sanity.fetch<MenuDay[]>(
    `*[
      _type == "menuDay" &&
      date == $date &&
      planTier == $planTier &&
      ${CUSTOMER_VISIBLE_FILTER}
    ] | order(category asc){
      ${MENU_DAY_PROJECTION}
    }`,
    { date, planTier },
  );

  return Array.isArray(rows) ? rows.filter((m) => menuDayHasDisplayableCopy(m)) : [];
}

export { menuDayHasDisplayableCopy } from "@/lib/sanity/menuDayGuards";
export { getClosedDatesForDate } from "@/lib/sanity/getClosedDatesForDate";
