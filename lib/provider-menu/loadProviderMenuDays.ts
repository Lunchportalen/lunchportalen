// lib/provider-menu/loadProviderMenuDays.ts
import "server-only";

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { menuDayProviderGroqClause } from "@/lib/cms/menuDayProviderFilter";
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
  customerVisible
`;

export async function loadProviderMenuDaysForDates(
  providerId: string,
  dates: string[],
): Promise<ProviderMenuDayRow[]> {
  const cleaned = [...new Set(dates.map((d) => String(d ?? "").trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
  if (!providerId || cleaned.length === 0) return [];

  const provider = menuDayProviderGroqClause({
    providerRef: providerId,
    providerSlug: null,
  });

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
    }>
  >(
    `*[
      _type == "menuDay" &&
      date in $dates &&
      (${provider.clause}) &&
      !(_id in path("drafts.**"))
    ] | order(date asc, planTier asc, category asc){
      ${PROVIDER_MENU_PROJECTION}
    }`,
    { dates: cleaned, ...provider.params },
  );

  const list = Array.isArray(rows) ? rows : [];
  return list.map((row) => {
    const published = Boolean(row.approvedForPublish) && Boolean(row.customerVisible);
    const tier = String(row.planTier ?? "").toUpperCase() as PlanTier;
    const sourceRaw = String(row.enterpriseSourcePackage ?? "").trim().toUpperCase();
    const sourcePackage =
      sourceRaw === "BASIS" || sourceRaw === "LUXUS" || sourceRaw === "ENTERPRISE"
        ? (sourceRaw as PlanTier)
        : null;
    return {
      id: row._id,
      date: row.date,
      tier,
      category: row.category,
      mealTitle: String(row.mealTitle ?? "").trim(),
      description: String(row.description ?? "").trim(),
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
    };
  });
}
