import "server-only";

import type { MenuDay } from "@/lib/cms/menuDay";
import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { asPlanTier } from "@/lib/cms/menuDayContract";

type MinimalDbClient = {
  from: (table: string) => any;
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function categoryFromProductSku(sku: string): Category | null {
  const s = safeStr(sku).toLowerCase();
  if (s === "varmrett" || s.includes("varmmat")) return "varmrett";
  if (s === "paasmurt") return "paasmurt";
  if (s === "salatboks" || s === "salat") return "salat";
  if (s === "sushi") return "sushi";
  if (s === "pokebowl") return "pokebowl";
  if (s === "thaimat" || s === "thai") return "thai";
  return null;
}

/**
 * Provider-scoped MSDI fallback for employee week when Sanity menuDay read misses.
 * Fail-closed: requires company, location, and provider scope — no cross-provider fallback.
 */
export async function loadEmployeeWeekMenusFromMsdi(
  db: MinimalDbClient,
  params: {
    companyId: string;
    locationId: string | null;
    providerId: string;
    dates: string[];
    tierByDate: Map<string, PlanTier>;
  },
): Promise<Map<string, MenuDay[]>> {
  const companyId = safeStr(params.companyId);
  const locationId = safeStr(params.locationId);
  const providerId = safeStr(params.providerId);
  const dates = params.dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

  const out = new Map<string, MenuDay[]>();
  if (!companyId || !locationId || !providerId || dates.length === 0) return out;

  const { data: msdRows, error: msdErr } = await db
    .from("menu_service_days")
    .select("id, service_date, state")
    .eq("company_id", companyId)
    .eq("location_id", locationId)
    .eq("provider_id", providerId)
    .eq("state", "published")
    .in("service_date", dates);

  if (msdErr || !Array.isArray(msdRows) || msdRows.length === 0) return out;

  const msdIds = msdRows.map((r) => safeStr((r as { id?: string }).id)).filter(Boolean);
  if (!msdIds.length) return out;

  const { data: msdiRows, error: msdiErr } = await db
    .from("menu_service_day_items")
    .select("menu_service_day_id, product_id, product_name_snapshot, products(sku)")
    .in("menu_service_day_id", msdIds);

  if (msdiErr || !Array.isArray(msdiRows)) return out;

  const itemsByMsd = new Map<string, unknown[]>();
  for (const row of msdiRows) {
    const msdId = safeStr((row as { menu_service_day_id?: string }).menu_service_day_id);
    if (!msdId) continue;
    const list = itemsByMsd.get(msdId) ?? [];
    list.push(row);
    itemsByMsd.set(msdId, list);
  }

  for (const msd of msdRows) {
    const msdId = safeStr((msd as { id?: string }).id);
    const date = safeStr((msd as { service_date?: string }).service_date);
    if (!msdId || !date) continue;

    const tier = asPlanTier(params.tierByDate.get(date)) ?? "BASIS";
    const items = itemsByMsd.get(msdId) ?? [];
    const menus: MenuDay[] = [];

    for (const item of items) {
      const title = safeStr((item as { product_name_snapshot?: string }).product_name_snapshot);
      if (!title) continue;
      const products = (item as { products?: { sku?: string } | { sku?: string }[] | null }).products;
      const sku = Array.isArray(products)
        ? safeStr(products[0]?.sku)
        : safeStr((products as { sku?: string } | null)?.sku);
      const category = categoryFromProductSku(sku) ?? "varmrett";

      menus.push({
        _id: `msdi-${msdId}-${safeStr((item as { product_id?: string }).product_id)}`,
        date,
        planTier: tier,
        category,
        mealTitle: title,
        title,
        isPublished: true,
      });
    }

    if (menus.length > 0) out.set(date, menus);
  }

  return out;
}
