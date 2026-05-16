/**
 * Sanity `lunchCategory` — statiske menyvarianter (ikke varmrett) for ansattflate / order resolver.
 */
import "server-only";

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import type { MenuItemData } from "@/lib/cms/menuDay";
import { sanity } from "@/lib/sanity/client";

export type LunchCategorySanityRow = {
  key: string | null;
  allowedPlanTiers?: string[] | null;
  items?: unknown;
};

function categoryFromLunchCategoryDocKey(k: string | null): Category | null {
  const s = String(k ?? "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === "paasmurt") return "paasmurt";
  if (s === "salatboks") return "salat";
  if (s === "sushi") return "sushi";
  if (s === "pokebowl") return "pokebowl";
  if (s === "thaimat") return "thai";
  if (s === "varmrett") return "varmrett";
  return null;
}

function itemRawAllowedForPlanTier(o: Record<string, unknown>, planTier: PlanTier | undefined): boolean {
  if (!planTier) return true;
  const tierUpper = planTier.toUpperCase();
  const itemTiers = o.allowedPlanTiers;
  if (!Array.isArray(itemTiers) || itemTiers.length === 0) return true;
  return itemTiers.some((t) => String(t).toUpperCase() === tierUpper);
}

/** Rå Sanity-objekter for én tier (f.eks. menu_service_day_items-snapshot). */
export function filterLunchCategoryItemsRawForPlanTier(raw: unknown, planTier: PlanTier): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row) => {
    if (!row || typeof row !== "object") return false;
    return itemRawAllowedForPlanTier(row as Record<string, unknown>, planTier);
  });
}

export function mapLunchCategoryDocItemsToMenuItems(raw: unknown, planTier?: PlanTier): MenuItemData[] {
  if (!Array.isArray(raw)) return [];
  const out: MenuItemData[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (!itemRawAllowedForPlanTier(o, planTier)) continue;
    const slug = o.slug as { current?: string } | undefined;
    const key = String(slug?.current ?? "").trim();
    if (!key) continue;
    const title = String(o.title ?? "").trim() || key;
    const descRaw = o.description;
    const description =
      typeof descRaw === "string" && descRaw.trim().length > 0 ? descRaw.trim() : null;
    const allergens = Array.isArray(o.allergens) ? o.allergens.map((a) => String(a)) : [];
    const isVegetarian = o.isVegetarian === true;
    out.push({
      key,
      title,
      ...(description ? { description } : {}),
      allergens,
      isVegetarian,
      available: true,
    });
  }
  return out;
}

export function staticMenuItemsByCategoryForPlanTier(
  rows: LunchCategorySanityRow[],
  planTier: PlanTier,
): Partial<Record<Category, MenuItemData[]>> {
  const tierUpper = planTier.toUpperCase();
  const out: Partial<Record<Category, MenuItemData[]>> = {};
  for (const row of rows) {
    const cat = categoryFromLunchCategoryDocKey(row.key);
    if (!cat || cat === "varmrett") continue;
    const tiers = Array.isArray(row.allowedPlanTiers) ? row.allowedPlanTiers : [];
    if (!tiers.some((t) => String(t).toUpperCase() === tierUpper)) continue;
    const items = mapLunchCategoryDocItemsToMenuItems(row.items, planTier);
    if (items.length > 0) out[cat] = items;
  }
  return out;
}

export async function fetchActiveLunchCategoryRows(): Promise<LunchCategorySanityRow[]> {
  const rows = await sanity.fetch<LunchCategorySanityRow[]>(
    `*[_type == "lunchCategory" && isActive == true] | order(displayOrder asc) {
      "key": key.current,
      allowedPlanTiers,
      items
    }`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function getLunchCategoryStaticItemsByPlanTier(
  planTier: PlanTier,
): Promise<Partial<Record<Category, MenuItemData[]>>> {
  const rows = await fetchActiveLunchCategoryRows();
  return staticMenuItemsByCategoryForPlanTier(rows, planTier);
}
