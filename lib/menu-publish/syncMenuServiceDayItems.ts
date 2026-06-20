import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanityServer } from "@/lib/sanity/server";

import { filterLunchCategoryItemsRawForPlanTier } from "@/lib/cms/lunchCategory";
import { CATEGORY_LABELS, PLAN_CATEGORIES, type Category, type PlanTier } from "@/lib/cms/menuDayContract";
import { isoDateToAgreementDayKey, normalizeMenuPlanTier } from "@/lib/menu-publish/menuDaySyncShared";
import { TIER_PRICE_CENTS, VAT_RATE } from "./tierPricing";

/** Sanity `lunchCategory.key.current` → `product_categories.name` (Supabase seed). */
export const LUNCH_CATEGORY_KEY_TO_DB_NAME: Record<string, string> = {
  paasmurt: "Paasmurt",
  salatboks: "Salatboks",
  sushi: "Sushi",
  pokebowl: "Pokebowl",
  thaimat: "Thaimat",
  varmrett: "Varmrett",
};

const ALLOWED_SKUS = ["paasmurt", "salatboks", "sushi", "pokebowl", "thaimat", "varmrett"] as const;

type LunchCatRow = {
  key: string | null;
  title: string | null;
  displayOrder?: number | null;
  items?: unknown[] | null;
};

type VarmrettMenuProjection = {
  mealTitle?: string | null;
  meal?: {
    title?: string | null;
    description?: string | null;
    allergens?: string[] | null;
  } | null;
} | null;

export type MenuServiceDayItemsSyncStats = {
  msdiRowsUpserted: number;
  msdiLocationsSkippedNoTier: number;
};

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function formatStaticCategorySnapshot(title: string, items: unknown): string {
  const parts: string[] = [title.trim()].filter(Boolean);
  if (!Array.isArray(items)) return parts.join(" · ");
  for (const raw of items) {
    const it = asRecord(raw);
    if (!it) continue;
    const slug = asRecord(it.slug);
    const slugCur = slug ? safeTrim(slug.current) : "";
    const t = safeTrim(it.title) || slugCur;
    if (t) parts.push(t);
    const d = safeTrim(it.description);
    if (d) parts.push(d);
    const allergens = it.allergens;
    if (Array.isArray(allergens) && allergens.length) {
      parts.push(`Allergener: ${allergens.map((a) => safeTrim(a)).filter(Boolean).join(", ")}`);
    }
  }
  return parts.filter(Boolean).join(" · ");
}

function formatVarmrettSnapshot(projection: VarmrettMenuProjection): string {
  const parts: string[] = [];
  const mealTitle = projection?.mealTitle ? safeTrim(projection.mealTitle) : "";
  if (mealTitle) parts.push(mealTitle);
  const meal = projection?.meal;
  if (meal) {
    const t = safeTrim(meal.title);
    if (t) parts.push(t);
    const d = safeTrim(meal.description);
    if (d) parts.push(d);
    const allergens = meal.allergens;
    if (Array.isArray(allergens) && allergens.length) {
      parts.push(`Allergener: ${allergens.map((a) => safeTrim(a)).filter(Boolean).join(", ")}`);
    }
  }
  return parts.filter(Boolean).join(" · ") || "Varmrett";
}

/** Sanity lunchCategory key for product lookup (PLAN category salat/thai differ from SKU keys). */
const PLAN_CATEGORY_TO_LUNCH_KEY: Partial<Record<Category, string>> = {
  salat: "salatboks",
  thai: "thaimat",
};

function lunchKeyForPlanCategory(category: Category): string {
  return PLAN_CATEGORY_TO_LUNCH_KEY[category] ?? category;
}

function buildFallbackLunchCategoriesForTier(tier: PlanTier): LunchCatRow[] {
  const planCats = PLAN_CATEGORIES[tier] ?? [];
  const rows: LunchCatRow[] = [];
  for (let i = 0; i < planCats.length; i += 1) {
    const category = planCats[i];
    const key = lunchKeyForPlanCategory(category);
    if (!LUNCH_CATEGORY_KEY_TO_DB_NAME[key]) continue;
    rows.push({
      key,
      title: CATEGORY_LABELS[category] ?? LUNCH_CATEGORY_KEY_TO_DB_NAME[key],
      displayOrder: i + 1,
      items: [],
    });
  }
  return rows;
}

async function fetchLunchCategoriesForTier(tier: PlanTier, providerId: string): Promise<LunchCatRow[]> {
  const { fetchLunchCategoryRowsForProvider } = await import("@/lib/cms/lunchCategory");
  const rows = await fetchLunchCategoryRowsForProvider(providerId);
  const tierUpper = tier.toUpperCase();
  const filtered = rows.filter((row) => {
    const tiers = Array.isArray(row.allowedPlanTiers) ? row.allowedPlanTiers : [];
    return tiers.some((t) => String(t).toUpperCase() === tierUpper);
  });
  return filtered.map((row) => ({
    key: row.key,
    title: row.title ?? null,
    displayOrder: row.displayOrder ?? null,
    items: (Array.isArray(row.items) ? row.items : null) as unknown[] | null,
  }));
}

async function fetchVarmrettMenuProjection(
  dateISO: string,
  tier: PlanTier,
  providerRef: string,
): Promise<VarmrettMenuProjection> {
  // provider._ref-filter: varmrett-snapshot må komme fra samme provider som
  // menuDay-publiseringen — aldri en annen providers innhold for samme dato/tier.
  const q = `*[
    _type == "menuDay" &&
    provider._ref == $providerRef &&
    date == $date &&
    planTier == $tier &&
    category == "varmrett" &&
    !(_id in path("drafts.**"))
  ] | order(_updatedAt desc)[0]{
    mealTitle,
    "meal": mealRef->{ title, description, allergens }
  }`;
  return sanityServer.fetch<VarmrettMenuProjection>(q, { date: dateISO, tier, providerRef });
}

/**
 * Etter publisert menuDay: fyll `menu_service_day_items` per lokasjon ut fra faktisk tier for ukedag
 * (`agreement_delivery_days`). Fail-closed: ingen MSDI-rader for lokasjon uten tier-rad.
 *
 * Bruker service_role-klient (admin) for RLS-bypass.
 */
export async function syncMenuServiceDayItemsAfterMenuDayPublish(
  admin: SupabaseClient<any>,
  params: {
    serviceDate: string;
    /** Alle lokasjoner som nettopp fikk menu_service_days UPSERT (samme som publish-sync). */
    locationIds: string[];
    /** Supabase providers.id (== Sanity provider `_id`). Fail-closed: ingen MSDI uten provider-scope. */
    providerId: string;
  },
): Promise<MenuServiceDayItemsSyncStats> {
  const { serviceDate, locationIds } = params;
  const providerId = safeTrim(params.providerId);
  if (!providerId) {
    return { msdiRowsUpserted: 0, msdiLocationsSkippedNoTier: 0 };
  }

  const uniqueLocs = [...new Set(locationIds.map((id) => safeTrim(id)).filter(Boolean))];
  if (uniqueLocs.length === 0) {
    return { msdiRowsUpserted: 0, msdiLocationsSkippedNoTier: 0 };
  }

  const dayKey = isoDateToAgreementDayKey(serviceDate);
  if (!dayKey) {
    return { msdiRowsUpserted: 0, msdiLocationsSkippedNoTier: 0 };
  }

  const { data: locRows, error: locErr } = await admin.from("company_locations").select("id, company_id").in("id", uniqueLocs);

  if (locErr) {
    throw new Error(`company_locations (msdi): ${locErr.message}`);
  }

  const companyByLocation = new Map<string, string>();
  for (const r of locRows ?? []) {
    const row = r as { id?: string; company_id?: string };
    const lid = safeTrim(row.id);
    const cid = safeTrim(row.company_id);
    if (lid && cid) companyByLocation.set(lid, cid);
  }

  const { data: msdRows, error: msdErr } = await admin
    .from("menu_service_days")
    .select("id, location_id")
    .eq("service_date", serviceDate)
    .eq("provider_id", providerId)
    .in("location_id", uniqueLocs);

  if (msdErr) {
    throw new Error(`menu_service_days (msdi): ${msdErr.message}`);
  }

  const msdIdByLocation = new Map<string, string>();
  for (const r of msdRows ?? []) {
    const row = r as { id?: string; location_id?: string };
    const lid = safeTrim(row.location_id);
    const id = safeTrim(row.id);
    if (lid && id) msdIdByLocation.set(lid, id);
  }

  const { data: pcRows, error: pcErr } = await admin
    .from("product_categories")
    .select("id, name")
    .in("name", Object.values(LUNCH_CATEGORY_KEY_TO_DB_NAME));

  if (pcErr) {
    throw new Error(`product_categories (msdi): ${pcErr.message}`);
  }

  const categoryIdByName = new Map<string, string>();
  for (const r of pcRows ?? []) {
    const row = r as { id?: string; name?: string };
    const name = safeTrim(row.name);
    const id = safeTrim(row.id);
    if (name && id) categoryIdByName.set(name, id);
  }

  const categoryIds = [...categoryIdByName.values()];
  if (categoryIds.length === 0) {
    throw new Error("MSDI_SYNC_MISSING_PRODUCT_CATEGORIES");
  }

  const { data: prodRows, error: prodErr } = await admin
    .from("products")
    .select("id, sku, category_id")
    .is("company_id", null)
    .in("category_id", categoryIds)
    .in("sku", [...ALLOWED_SKUS]);

  if (prodErr) {
    throw new Error(`products (msdi): ${prodErr.message}`);
  }

  const catIdToName = new Map<string, string>();
  for (const [name, id] of categoryIdByName.entries()) {
    catIdToName.set(id, name);
  }

  /** Key: `${categoryName}|${sku}` → product uuid */
  const productIdByCategoryAndSku = new Map<string, string>();
  for (const r of prodRows ?? []) {
    const row = r as { id?: string; sku?: string | null; category_id?: string };
    const pid = safeTrim(row.id);
    const sku = safeTrim(row.sku).toLowerCase();
    const cid = safeTrim(row.category_id);
    if (!pid || !sku || !cid) continue;
    const catName = catIdToName.get(cid);
    if (!catName) continue;
    productIdByCategoryAndSku.set(`${catName}|${sku}`, pid);
  }

  const tierCache = new Map<PlanTier, { categories: LunchCatRow[]; varmrett: VarmrettMenuProjection }>();
  const upsertPayload: Array<{
    menu_service_day_id: string;
    product_id: string;
    product_name_snapshot: string;
    unit_name_snapshot: string;
    offered_price_cents_ex_vat: number;
    vat_rate_snapshot: number;
    quantity: number;
    sort_order: number;
    is_optional: boolean;
  }> = [];

  let msdiLocationsSkippedNoTier = 0;

  for (const locationId of uniqueLocs) {
    const companyId = companyByLocation.get(locationId);
    const menuServiceDayId = msdIdByLocation.get(locationId);
    if (!companyId || !menuServiceDayId) continue;

    const { data: companyRow, error: companyErr } = await admin
      .from("companies")
      .select("id, provider_id")
      .eq("id", companyId)
      .maybeSingle();

    if (companyErr) {
      throw new Error(`companies (msdi): ${companyErr.message}`);
    }
    if (safeTrim((companyRow as { provider_id?: string } | null)?.provider_id) !== providerId) {
      continue;
    }

    const { data: agr, error: agrErr } = await admin
      .from("agreements")
      .select("id")
      .eq("company_id", companyId)
      .eq("location_id", locationId)
      .eq("status", "ACTIVE")
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (agrErr) {
      throw new Error(`agreements (msdi): ${agrErr.message}`);
    }
    const agreementId = safeTrim((agr as { id?: string } | null)?.id);
    if (!agreementId) continue;

    const { data: dayTierRow, error: dtErr } = await admin
      .from("agreement_delivery_days")
      .select("tier")
      .eq("agreement_id", agreementId)
      .eq("weekday", dayKey)
      .maybeSingle();

    if (dtErr) {
      throw new Error(`agreement_delivery_days (msdi): ${dtErr.message}`);
    }

    const tierRaw = safeTrim((dayTierRow as { tier?: string } | null)?.tier).toUpperCase();
    const tier = normalizeMenuPlanTier(tierRaw);
    if (!tier) {
      msdiLocationsSkippedNoTier += 1;
      continue;
    }

    let cached = tierCache.get(tier);
    if (!cached) {
      let categories = await fetchLunchCategoriesForTier(tier, providerId);
      if (categories.length === 0) {
        categories = buildFallbackLunchCategoriesForTier(tier);
      }
      if (categories.length === 0) {
        throw new Error(`MSDI_SYNC_EMPTY_LUNCH_CATEGORIES:${tier}`);
      }
      const varmrett = await fetchVarmrettMenuProjection(serviceDate, tier, providerId);
      cached = { categories, varmrett };
      tierCache.set(tier, cached);
    }

    const priceCents = TIER_PRICE_CENTS[tier];
    let ord = 0;

    for (const cat of cached.categories) {
      const key = safeTrim(cat.key).toLowerCase();
      if (!key) continue;
      const dbCatName = LUNCH_CATEGORY_KEY_TO_DB_NAME[key];
      if (!dbCatName) continue;

      const sku = key;
      const productId = productIdByCategoryAndSku.get(`${dbCatName}|${sku}`);
      if (!productId) {
        throw new Error(`MSDI_SYNC_MISSING_PRODUCT_FOR_CATEGORY:${dbCatName}:${sku}`);
      }

      ord += 1;
      const sortOrder = typeof cat.displayOrder === "number" && Number.isFinite(cat.displayOrder) ? cat.displayOrder : ord;

      let productNameSnapshot: string;
      if (key === "varmrett") {
        productNameSnapshot = formatVarmrettSnapshot(cached.varmrett);
      } else {
        const title = safeTrim(cat.title) || dbCatName;
        productNameSnapshot = formatStaticCategorySnapshot(
          title,
          filterLunchCategoryItemsRawForPlanTier(cat.items ?? [], tier),
        );
      }

      upsertPayload.push({
        menu_service_day_id: menuServiceDayId,
        product_id: productId,
        product_name_snapshot: productNameSnapshot,
        unit_name_snapshot: "porsjon",
        offered_price_cents_ex_vat: priceCents,
        vat_rate_snapshot: VAT_RATE,
        quantity: 1,
        sort_order: sortOrder,
        is_optional: false,
      });
    }
  }

  if (upsertPayload.length === 0) {
    return { msdiRowsUpserted: 0, msdiLocationsSkippedNoTier };
  }

  const { error: upErr } = await admin.from("menu_service_day_items").upsert(upsertPayload, {
    onConflict: "menu_service_day_id,product_id",
  });

  if (upErr) {
    throw new Error(`menu_service_day_items upsert: ${upErr.message}`);
  }

  return {
    msdiRowsUpserted: upsertPayload.length,
    msdiLocationsSkippedNoTier,
  };
}
