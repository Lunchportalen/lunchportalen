import "server-only";

import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import { osloTodayISODate } from "@/lib/date/oslo";
import type { ProviderMenuCatalogSnapshot } from "@/lib/provider-menu/lunchCategoryCatalog";
import type { ProviderMenuDayRow } from "@/lib/provider-menu/loadProviderMenuDays";
import type { MenuCatalogWriteInput } from "@/lib/provider-menu/menuCatalogWrite";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const MENU_ORDER_LOCKED_CODE = "MENU_ORDER_LOCKED" as const;

export type ProviderOrderLockState = {
  datesWithOrders: ReadonlySet<string>;
  /** `categoryKey::itemSlug` (lowercase) */
  lockedCatalogItemKeys: ReadonlySet<string>;
  /** Distinct ACTIVE order employees per service date (provider-scoped). */
  orderCountsByDate: ReadonlyMap<string, number>;
  /** Fail-closed: treat writes as locked when Supabase check failed */
  queryFailed: boolean;
};

type OrderRow = {
  user_id: string;
  date: string;
  company_id: string;
  location_id: string;
};

type DayChoiceRow = {
  user_id: string;
  date: string;
  company_id: string;
  location_id: string;
  choice_key: string;
  item_key: string | null;
  status: string;
};

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

function orderMatchKey(row: { user_id: string; date: string; company_id: string; location_id: string }): string {
  return `${row.user_id}|${row.date}|${row.company_id}|${row.location_id}`;
}

function catalogLockKey(categoryKey: string, itemSlug: string): string {
  return `${categoryKey.toLowerCase()}::${itemSlug.toLowerCase()}`;
}

/** Map day_choices.choice_key → lunchCategory doc key (editable catalog keys). */
export function lunchCategoryKeyFromChoiceKey(choiceKey: string): string | null {
  const n = normalizeMealTypeKey(choiceKey);
  if (!n) return null;
  if (n === "paasmurt") return "paasmurt";
  if (n === "salat" || n === "salatboks" || n === "salatbar") return "salatboks";
  if (n === "sushi") return "sushi";
  if (n === "pokebowl" || n === "poke") return "pokebowl";
  if (n === "thai" || n === "thaimat") return "thaimat";
  return null;
}

function failClosedState(): ProviderOrderLockState {
  return {
    datesWithOrders: new Set(),
    lockedCatalogItemKeys: new Set(),
    orderCountsByDate: new Map(),
    queryFailed: true,
  };
}

export async function loadProviderOrderLockState(providerId: string): Promise<ProviderOrderLockState> {
  const pid = safeTrim(providerId);
  if (!pid) return failClosedState();

  const osloToday = osloTodayISODate();

  try {
    const admin = supabaseAdmin();
    const { data: ordersRaw, error: ordersError } = await admin
      .from("orders")
      .select("user_id, date, company_id, location_id")
      .eq("provider_id", pid)
      .eq("status", "ACTIVE")
      .gte("date", osloToday);

    if (ordersError) return failClosedState();

    const orders = (ordersRaw ?? []) as OrderRow[];
    if (orders.length === 0) {
      return {
        datesWithOrders: new Set(),
        lockedCatalogItemKeys: new Set(),
        orderCountsByDate: new Map(),
        queryFailed: false,
      };
    }

    const orderKeys = new Set(orders.map(orderMatchKey));
    const datesWithOrders = new Set(orders.map((o) => o.date));
    const usersByDate = new Map<string, Set<string>>();
    for (const o of orders) {
      const bucket = usersByDate.get(o.date) ?? new Set<string>();
      bucket.add(o.user_id);
      usersByDate.set(o.date, bucket);
    }
    const orderCountsByDate = new Map<string, number>();
    for (const [date, users] of usersByDate.entries()) {
      orderCountsByDate.set(date, users.size);
    }
    const dates = [...datesWithOrders];

    const { data: choicesRaw, error: choicesError } = await admin
      .from("day_choices")
      .select("user_id, date, company_id, location_id, choice_key, item_key, status")
      .in("date", dates)
      .eq("status", "ACTIVE");

    if (choicesError) return failClosedState();

    const lockedCatalogItemKeys = new Set<string>();
    for (const dc of (choicesRaw ?? []) as DayChoiceRow[]) {
      if (!orderKeys.has(orderMatchKey(dc))) continue;
      const itemSlug = safeTrim(dc.item_key).toLowerCase();
      if (!itemSlug) continue;
      const categoryKey = lunchCategoryKeyFromChoiceKey(dc.choice_key);
      if (!categoryKey) continue;
      lockedCatalogItemKeys.add(catalogLockKey(categoryKey, itemSlug));
    }

    return {
      datesWithOrders,
      lockedCatalogItemKeys,
      orderCountsByDate,
      queryFailed: false,
    };
  } catch {
    return failClosedState();
  }
}

export function isVarmrettDateLocked(state: ProviderOrderLockState, date: string): boolean {
  const d = safeTrim(date);
  if (!d) return state.queryFailed;
  if (state.queryFailed) return d >= osloTodayISODate();
  return state.datesWithOrders.has(d);
}

export function isCatalogItemLocked(state: ProviderOrderLockState, categoryKey: string, itemSlug: string): boolean {
  const slug = safeTrim(itemSlug).toLowerCase();
  if (!slug) return false;
  const cat = safeTrim(categoryKey).toLowerCase();
  if (!cat) return state.queryFailed;
  if (state.queryFailed) return true;
  return state.lockedCatalogItemKeys.has(catalogLockKey(cat, slug));
}

function normalizeAllergenSet(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((a) => safeTrim(a).toLowerCase()).filter(Boolean))].sort();
}

function catalogItemContentEqual(
  existing: {
    title?: string;
    description?: string | null;
    allergens?: string[] | null;
    isVegetarian?: boolean | null;
  },
  next: {
    title: string;
    description?: string | null;
    allergens?: string[] | null;
    isVegetarian?: boolean | null;
  },
): boolean {
  if (safeTrim(existing.title) !== safeTrim(next.title)) return false;
  const exDesc = safeTrim(existing.description);
  const nextDesc = safeTrim(next.description);
  if (exDesc !== nextDesc) return false;
  const exAlg = normalizeAllergenSet(existing.allergens);
  const nextAlg = normalizeAllergenSet(next.allergens);
  if (exAlg.join("|") !== nextAlg.join("|")) return false;
  const exVeg = existing.isVegetarian === true;
  const nextVeg = next.isVegetarian === true;
  if (exVeg !== nextVeg) return false;
  return true;
}

export class ProviderMenuOrderLockError extends Error {
  readonly code = MENU_ORDER_LOCKED_CODE;
  readonly lockedKeys?: string[];
  readonly lockedDates?: string[];

  constructor(message: string, opts?: { lockedKeys?: string[]; lockedDates?: string[] }) {
    super(message);
    this.name = "ProviderMenuOrderLockError";
    this.lockedKeys = opts?.lockedKeys;
    this.lockedDates = opts?.lockedDates;
  }
}

export function assertCatalogWriteAllowed(
  state: ProviderOrderLockState,
  categoryKey: string,
  existingItems: Map<string, Record<string, unknown>>,
  input: MenuCatalogWriteInput,
): void {
  const cat = safeTrim(categoryKey).toLowerCase();
  const nextKeys = new Set<string>();
  const violations: string[] = [];

  for (const raw of input.items) {
    const keyInput = safeTrim(raw.key).toLowerCase();
    if (keyInput) {
      nextKeys.add(keyInput);
      const existing = existingItems.get(keyInput);
      if (!existing) continue;
      if (isCatalogItemLocked(state, cat, keyInput)) {
        const ex = existing as Record<string, unknown>;
        const changed = !catalogItemContentEqual(
          {
            title: safeTrim(ex.title),
            description: typeof ex.description === "string" ? ex.description : null,
            allergens: Array.isArray(ex.allergens) ? (ex.allergens as string[]) : null,
            isVegetarian: ex.isVegetarian === true,
          },
          {
            title: raw.title,
            description: raw.description,
            allergens: raw.allergens,
            isVegetarian: raw.isVegetarian,
          },
        );
        if (changed) violations.push(keyInput);
      }
    }
  }

  for (const [existingKey, existing] of existingItems.entries()) {
    if (!nextKeys.has(existingKey)) {
      if (isCatalogItemLocked(state, cat, existingKey)) {
        violations.push(existingKey);
      }
    }
  }

  if (state.queryFailed && existingItems.size > 0) {
    throw new ProviderMenuOrderLockError(
      "Menyen er låst for redigering (bestillingskontroll feilet). Prøv igjen senere.",
      { lockedKeys: [...existingItems.keys()] },
    );
  }

  if (violations.length > 0) {
    throw new ProviderMenuOrderLockError(
      "Valg med aktiv bestilling kan ikke endres, fjernes eller omdøpes.",
      { lockedKeys: [...new Set(violations)] },
    );
  }
}

export function assertVarmrettContentChangeAllowed(
  state: ProviderOrderLockState,
  date: string,
  before: {
    mealTitle: string;
    description: string;
    allergensText?: string | null;
    estimatedCostPerPortion?: number | null;
  },
  after: {
    mealTitle: string;
    description: string;
    allergensText?: string | null;
    estimatedCostPerPortion?: number | null;
  },
): void {
  if (!isVarmrettDateLocked(state, date)) return;

  const sameTitle = safeTrim(before.mealTitle) === safeTrim(after.mealTitle);
  const sameDesc = safeTrim(before.description) === safeTrim(after.description);
  const sameAlg =
    normalizeAllergenSet(safeTrim(before.allergensText).split(/[,;]+/)).join("|") ===
    normalizeAllergenSet(safeTrim(after.allergensText).split(/[,;]+/)).join("|");
  const beforeCost = before.estimatedCostPerPortion ?? null;
  const afterCost = after.estimatedCostPerPortion ?? null;
  const sameCost = beforeCost === afterCost;

  if (sameTitle && sameDesc && sameAlg && sameCost) return;

  throw new ProviderMenuOrderLockError(
    state.queryFailed
      ? "Varmrett er låst (bestillingskontroll feilet). Prøv igjen senere."
      : "Varmrett med aktiv bestilling kan ikke endres for denne dagen.",
    { lockedDates: [date] },
  );
}

export function applyOrderLocksToCatalog(
  catalog: ProviderMenuCatalogSnapshot,
  state: ProviderOrderLockState,
): ProviderMenuCatalogSnapshot {
  return {
    rows: catalog.rows.map((row) => {
      const catKey = safeTrim(row.key).toLowerCase();
      return {
        ...row,
        items: (row.items ?? []).map((item) => ({
          ...item,
          orderLocked: isCatalogItemLocked(state, catKey, item.key),
        })),
      };
    }),
  };
}

export function applyOrderLocksToMenuDayRows(
  rows: ProviderMenuDayRow[],
  state: ProviderOrderLockState,
): ProviderMenuDayRow[] {
  return rows.map((row) => ({
    ...row,
    orderLocked: row.category === "varmrett" ? isVarmrettDateLocked(state, row.date) : false,
  }));
}
