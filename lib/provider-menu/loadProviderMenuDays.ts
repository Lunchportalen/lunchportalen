// lib/provider-menu/loadProviderMenuDays.ts
import "server-only";

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { PLAN_TIERS } from "@/lib/cms/menuDayContract";
import { menuDayProviderGroqClause } from "@/lib/cms/menuDayProviderFilter";
import { MELHUS_PROVIDER_SANITY_ID } from "@/lib/cms/providerSanityConstants";
import { canonicalMenuCategory, menuSlotHasContent } from "@/lib/provider-menu/menuCategoryCanonical";
import { sanityServer } from "@/lib/sanity/server";

export type ProviderMenuDayRow = {
  id: string;
  date: string;
  tier: PlanTier;
  category: Category;
  mealTitle: string;
  description: string;
  allergens: string[];
  estimatedCostPerPortion: number | null;
  sourcePackage: PlanTier | null;
  upgradeType: string | null;
  upgradeNote: string | null;
  approvedForPublish: boolean;
  customerVisible: boolean;
  status: "draft" | "published";
  providerOverride?: boolean;
  autoFilled?: boolean;
  generatedBaseline?: {
    mealTitle?: string;
    description?: string;
    allergens?: string[];
    estimatedCostPerPortion?: number | null;
  } | null;
  /** WS-4: leveringsdag har aktiv bestilling — varmrett innhold låst */
  orderLocked?: boolean;
};

const PROVIDER_MENU_PROJECTION = `
  _id,
  date,
  planTier,
  category,
  mealTitle,
  description,
  allergens,
  estimatedCostPerPortion,
  enterpriseSourcePackage,
  enterpriseUpgradeType,
  enterpriseUpgradeNote,
  approvedForPublish,
  customerVisible,
  providerOverride,
  autoFilled,
  generatedBaseline
`;

export async function loadProviderMenuDaysForDates(
  providerId: string,
  dates: string[],
  opts?: { providerSlug?: string | null },
): Promise<ProviderMenuDayRow[]> {
  const cleaned = [...new Set(dates.map((d) => String(d ?? "").trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
  if (!providerId || cleaned.length === 0) return [];

  const provider = menuDayProviderGroqClause({
    providerRef: providerId,
    providerSlug: opts?.providerSlug ?? null,
  });

  const melhusLegacy =
    providerId === MELHUS_PROVIDER_SANITY_ID
      ? " || !defined(provider) || provider._ref == null"
      : "";

  const rows = await sanityServer.fetch<
    Array<{
      _id: string;
      date: string;
      planTier: PlanTier;
      category: Category;
      mealTitle?: string | null;
      description?: string | null;
      allergens?: string[] | null;
      estimatedCostPerPortion?: number | null;
      enterpriseSourcePackage?: string | null;
      enterpriseUpgradeType?: string | null;
      enterpriseUpgradeNote?: string | null;
      approvedForPublish?: boolean | null;
      customerVisible?: boolean | null;
      providerOverride?: boolean | null;
      autoFilled?: boolean | null;
      generatedBaseline?: {
        mealTitle?: string | null;
        description?: string | null;
        allergens?: string[] | null;
        estimatedCostPerPortion?: number | null;
      } | null;
    }>
  >(
    `*[
      _type == "menuDay" &&
      date in $dates &&
      ((${provider.clause})${melhusLegacy}) &&
      !(_id in path("drafts.**"))
    ] | order(date asc, planTier asc, category asc){
      ${PROVIDER_MENU_PROJECTION}
    }`,
    { dates: cleaned, ...provider.params },
  );

  const list = Array.isArray(rows) ? rows : [];
  const out: ProviderMenuDayRow[] = [];

  for (const row of list) {
    const tierRaw = String(row.planTier ?? "").trim().toUpperCase();
    const tier = PLAN_TIERS.includes(tierRaw as PlanTier) ? (tierRaw as PlanTier) : null;
    if (!tier) continue;

    let category = canonicalMenuCategory(row.category);
    if (!category && tier) {
      // Legacy varmrett-only menuDay rows may omit category — preserve as varmrett when content exists.
      if (menuSlotHasContent({ mealTitle: row.mealTitle, description: row.description, docId: row._id })) {
        category = "varmrett";
      }
    }
    if (!category) continue;

    const published = Boolean(row.approvedForPublish) && Boolean(row.customerVisible);
    const sourceRaw = String(row.enterpriseSourcePackage ?? "").trim().toUpperCase();
    const sourcePackage =
      sourceRaw === "BASIS" || sourceRaw === "LUXUS" || sourceRaw === "ENTERPRISE"
        ? (sourceRaw as PlanTier)
        : null;

    const mealTitle = String(row.mealTitle ?? "").trim();
    const description = String(row.description ?? "").trim();
    if (!menuSlotHasContent({ mealTitle, description, docId: row._id }) && !published) continue;

    out.push({
      id: row._id,
      date: row.date,
      tier,
      category,
      mealTitle,
      description,
      allergens: Array.isArray(row.allergens) ? row.allergens.map(String) : [],
      estimatedCostPerPortion:
        row.estimatedCostPerPortion != null && Number.isFinite(Number(row.estimatedCostPerPortion))
          ? Number(row.estimatedCostPerPortion)
          : null,
      sourcePackage,
      upgradeType: row.enterpriseUpgradeType != null ? String(row.enterpriseUpgradeType) : null,
      upgradeNote: row.enterpriseUpgradeNote != null ? String(row.enterpriseUpgradeNote) : null,
      approvedForPublish: Boolean(row.approvedForPublish),
      customerVisible: Boolean(row.customerVisible),
      status: published ? "published" : "draft",
      providerOverride: Boolean(row.providerOverride),
      autoFilled: Boolean(row.autoFilled),
      generatedBaseline: row.generatedBaseline ?? null,
    });
  }

  return out;
}

export async function loadProviderMenuDaySlot(
  providerId: string,
  input: { date: string; tier: PlanTier; category: Category },
  opts?: { providerSlug?: string | null },
): Promise<ProviderMenuDayRow | null> {
  const rows = await loadProviderMenuDaysForDates(providerId, [input.date], opts);
  const category = canonicalMenuCategory(input.category);
  if (!category) return null;
  return (
    rows.find((r) => r.date === input.date && r.tier === input.tier && r.category === category) ?? null
  );
}
