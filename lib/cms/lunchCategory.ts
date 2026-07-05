/**
 * Sanity `lunchCategory` — statiske menyvarianter (ikke varmrett) for ansattflate / order resolver.
 */
import "server-only";

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import type { MenuItemData } from "@/lib/cms/menuDay";
import { sanity } from "@/lib/sanity/client";
import {
  EDITABLE_LUNCH_CATEGORY_KEYS,
  LUNCH_CATEGORY_ALLERGENS,
  type EditableLunchCategoryKey,
} from "@/lib/provider-menu/lunchCategoryCatalog";

export type LunchCategorySanityRow = {
  key: string | null;
  title?: string | null;
  allowedPlanTiers?: string[] | null;
  displayOrder?: number | null;
  items?: unknown;
};

export { EDITABLE_LUNCH_CATEGORY_KEYS, LUNCH_CATEGORY_ALLERGENS, type EditableLunchCategoryKey };

const LUNCH_CATEGORY_ROW_PROJECTION = `{
  "key": key.current,
  title,
  allowedPlanTiers,
  displayOrder,
  items[] {
    "key": slug.current,
    title,
    description,
    allergens,
    isVegetarian,
    allowedPlanTiers
  }
}`;

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
  if (s === "vegetarian") return "vegetarian";
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
    const keyFromSlug = String(slug?.current ?? "").trim();
    const key = keyFromSlug || String(o.key ?? "").trim();
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

function rowKeyNorm(key: string | null | undefined): string {
  return String(key ?? "").trim().toLowerCase();
}

/**
 * Merge provider-scoped rows over global templates (per category key).
 * Varmrett alltid fra mal — provider-kopi ignoreres for lesing.
 */
export function mergeLunchCategoryRowsWithTemplateFallback(
  templates: LunchCategorySanityRow[],
  providerRows: LunchCategorySanityRow[],
): LunchCategorySanityRow[] {
  const providerByKey = new Map<string, LunchCategorySanityRow>();
  for (const row of providerRows) {
    const k = rowKeyNorm(row.key);
    if (!k || k === "varmrett") continue;
    providerByKey.set(k, row);
  }

  const merged: LunchCategorySanityRow[] = [];
  const seen = new Set<string>();

  for (const template of templates) {
    const k = rowKeyNorm(template.key);
    if (!k) continue;
    seen.add(k);
    if (k === "varmrett") {
      merged.push(template);
      continue;
    }
    const providerRow = providerByKey.get(k);
    merged.push(providerRow ?? template);
  }

  for (const [k, row] of providerByKey) {
    if (!seen.has(k)) merged.push(row);
  }

  return merged;
}

export async function fetchLunchCategoryTemplateRows(): Promise<LunchCategorySanityRow[]> {
  const rows = await sanity.fetch<LunchCategorySanityRow[]>(
    `*[_type == "lunchCategory" && isActive == true && !defined(provider)] | order(displayOrder asc) ${LUNCH_CATEGORY_ROW_PROJECTION}`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function fetchLunchCategoryRowsForProvider(providerId: string): Promise<LunchCategorySanityRow[]> {
  const pid = String(providerId ?? "").trim();
  if (!pid) return await fetchLunchCategoryTemplateRows();

  const [templates, providerRows] = await Promise.all([
    fetchLunchCategoryTemplateRows(),
    sanity.fetch<LunchCategorySanityRow[]>(
      `*[_type == "lunchCategory" && isActive == true && provider._ref == $providerRef] | order(displayOrder asc) ${LUNCH_CATEGORY_ROW_PROJECTION}`,
      { providerRef: pid },
    ),
  ]);

  const providerList = Array.isArray(providerRows) ? providerRows : [];
  return mergeLunchCategoryRowsWithTemplateFallback(templates, providerList);
}

/** Legacy global fetch — kun maler (scripts / fail-closed uten provider). */
export async function fetchActiveLunchCategoryRows(): Promise<LunchCategorySanityRow[]> {
  return fetchLunchCategoryTemplateRows();
}

export async function getLunchCategoryStaticItemsByPlanTier(
  planTier: PlanTier,
): Promise<Partial<Record<Category, MenuItemData[]>>> {
  const rows = await fetchActiveLunchCategoryRows();
  return staticMenuItemsByCategoryForPlanTier(rows, planTier);
}

export async function getLunchCategoryStaticItemsByPlanTierForProvider(
  providerId: string,
  planTier: PlanTier,
): Promise<Partial<Record<Category, MenuItemData[]>>> {
  const rows = await fetchLunchCategoryRowsForProvider(providerId);
  return staticMenuItemsByCategoryForPlanTier(rows, planTier);
}

export function providerLunchCategoryDocId(providerId: string, categoryKey: string): string {
  const pid = String(providerId).trim();
  const key = String(categoryKey).trim().toLowerCase();
  return `lunchCategory-${pid}-${key}`;
}

export function categoryTiersForEditableKey(categoryKey: string): PlanTier[] {
  const k = categoryKey.trim().toLowerCase();
  if (k === "paasmurt" || k === "salatboks") return ["BASIS", "LUXUS", "ENTERPRISE"];
  if (k === "sushi" || k === "pokebowl" || k === "thaimat" || k === "vegetarian") return ["LUXUS", "ENTERPRISE"];
  return [];
}

export function isEditableLunchCategoryKey(key: string): key is EditableLunchCategoryKey {
  return (EDITABLE_LUNCH_CATEGORY_KEYS as readonly string[]).includes(key.trim().toLowerCase());
}
