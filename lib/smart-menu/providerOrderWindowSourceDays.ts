/**
 * SMART-4 follow-up — load published menuDay rows as order-window overlay shape
 * for provider translation source extraction (provider-side only).
 */
import "server-only";

import {
  CATEGORY_LABELS,
  type Category,
  type MenuContent,
  type MenuItemData,
  getMenuForRange,
} from "@/lib/cms/menuDay";
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import type { OrderWindowDayForOverlay } from "@/lib/smart-menu/employeeApprovedTranslations";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MENU_DAY_CATEGORY_TO_ORDER_CHOICE: Record<Category, string> = {
  paasmurt: "paasmurt",
  salat: "salatboks",
  sushi: "sushi",
  pokebowl: "pokebowl",
  thai: "thaimat",
  vegetarian: "vegetarian",
  varmrett: "varmmat",
};

const ORDER_WINDOW_SOURCE_DAY_HORIZON = 28;

function mapMenuDayItems(items: MenuItemData[] | null | undefined) {
  return (items ?? [])
    .filter((it) => it && it.available !== false && typeof it.key === "string" && String(it.key).trim())
    .map((it) => ({
      key: String(it.key).trim(),
      title: String(it.title ?? it.key ?? "").trim() || String(it.key).trim(),
      description:
        typeof it.description === "string" && it.description.trim().length
          ? it.description.trim()
          : undefined,
      allergens: Array.isArray(it.allergens) ? it.allergens.map(String) : [],
      isVegetarian: it.isVegetarian === true,
    }));
}

/** Pure mapper — used by tests and server loader. */
export function mapPublishedMenuContentsToOrderWindowDays(
  menus: MenuContent[],
): OrderWindowDayForOverlay[] {
  const byDate = new Map<string, MenuContent[]>();
  for (const menu of menus) {
    const date = String(menu.date ?? "").trim();
    if (!date) continue;
    const list = byDate.get(date) ?? [];
    list.push(menu);
    byDate.set(date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => ({
      date,
      categories: rows
        .filter((row) => row.category)
        .map((row) => {
          const category = row.category as Category;
          return {
            key: MENU_DAY_CATEGORY_TO_ORDER_CHOICE[category] ?? category,
            category,
            label: CATEGORY_LABELS[category] ?? category,
            title: row.mealTitle ?? row.title ?? null,
            description: row.description ?? null,
            allergens: Array.isArray(row.allergens) ? row.allergens.map(String) : [],
            available: true,
            items: mapMenuDayItems(row.items),
          };
        }),
    }));
}

async function loadProviderSlug(providerId: string): Promise<string | null> {
  const pid = String(providerId ?? "").trim();
  if (!pid) return null;
  const { data, error } = await supabaseAdmin()
    .from("providers")
    .select("slug")
    .eq("id", pid)
    .maybeSingle();
  if (error) return null;
  return data?.slug != null ? String(data.slug).trim() || null : null;
}

/** Published customer-visible menuDay rows for provider — same Sanity filter as employee reads. */
export async function loadProviderOrderWindowDaysForTranslationSources(
  providerId: string,
): Promise<OrderWindowDayForOverlay[]> {
  const pid = String(providerId ?? "").trim();
  if (!pid) return [];

  const from = osloTodayISODate();
  const to = addDaysISO(from, ORDER_WINDOW_SOURCE_DAY_HORIZON);
  const providerSlug = await loadProviderSlug(pid);

  const menus = await getMenuForRange(from, to, {
    providerRef: pid,
    providerSlug,
  });

  return mapPublishedMenuContentsToOrderWindowDays(menus);
}
