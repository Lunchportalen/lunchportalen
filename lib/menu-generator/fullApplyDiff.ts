/**
 * Full category-level and item-level diff for localized week menu apply.
 */

import type { ProviderMenuDayRow } from "@/lib/provider-menu/loadProviderMenuDays";
import type { ProviderMenuCatalogSnapshot } from "@/lib/provider-menu/lunchCategoryCatalog";
import { categoryFromLunchCategoryKey, categoryRowForCategory } from "@/lib/provider-menu/lunchCategoryCatalog";
import { lunchCategoryKeyForFixed } from "@/lib/menu-generator/applyCapabilities";
import { buildApplyWeekDiff, type ApplyGeneratedVarmrettState } from "@/lib/menu-generator/applyWeekMenuDiff";
import type { ApplyOverwriteMode } from "@/lib/menu-generator/applyTypes";
import type { FullApplyMenuItem, FullLocalizedGeneratedWeekMenuDraft } from "@/lib/menu-generator/fullApplyDomain";
import type { FixedCategoryKey } from "@/lib/menu-generator/types";
import type { ProviderOrderLockState } from "@/lib/provider-menu/providerMenuOrderLock";
import { normalizeAllergenListForCompare } from "@/lib/menu-generator/allergenMenuDayFormat";

export type FullApplyCategoryStatus =
  | "would_create_category"
  | "would_update_category"
  | "would_replace_draft_category"
  | "would_skip_existing_category"
  | "would_skip_published_category"
  | "blocked_published_category"
  | "blocked_schema_unsupported"
  | "unchanged"
  | "failed";

export type FullApplyItemChange = {
  slug: string;
  title: string;
  change: "added" | "removed" | "changed" | "unchanged";
  titleChanged: boolean;
  descriptionChanged: boolean;
  allergenChanged: boolean;
};

export type FullApplyCategoryDiff = {
  categoryKey: FixedCategoryKey;
  displayName: string;
  schemaSupport: "supported" | "unsupported";
  writeTarget: "menuDay" | "lunchCategory" | "unsupported";
  status: FullApplyCategoryStatus;
  existingItemCount: number;
  generatedItemCount: number;
  addedItems: string[];
  removedItems: string[];
  changedItems: string[];
  unchangedItems: string[];
  itemChanges: FullApplyItemChange[];
  warnings: string[];
  blockedReason: string | null;
  providerLabel: string;
};

export type FullApplyDayDiff = {
  date: string;
  weekday: string;
  dayStatus: string;
  existingState: string;
  categories: FullApplyCategoryDiff[];
  varmrett: FullApplyCategoryDiff | null;
};

export type FullApplySummary = {
  createdDraftDays: number;
  updatedDraftDays: number;
  createdCategories: number;
  updatedCategories: number;
  skippedExistingCategories: number;
  skippedPublishedCategories: number;
  blockedPublishedCategories: number;
  unsupportedCategories: number;
  unchangedCategories: number;
  totalGeneratedDays: number;
  totalGeneratedCategories: number;
  totalGeneratedItems: number;
  failedDays: number;
};

export type FullApplyDiffResult = {
  days: FullApplyDayDiff[];
  catalogCategories: FullApplyCategoryDiff[];
  summary: FullApplySummary;
  warnings: string[];
  blockedReasons: string[];
  varmrettByDate: Map<string, ApplyGeneratedVarmrettState>;
};

function providerLabelForStatus(status: FullApplyCategoryStatus): string {
  switch (status) {
    case "would_create_category":
      return "Kategori opprettes";
    case "would_update_category":
    case "would_replace_draft_category":
      return "Utkast oppdateres";
    case "would_skip_existing_category":
      return "Eksisterende hoppes over";
    case "would_skip_published_category":
    case "blocked_published_category":
      return "Publisert kategori hoppes over";
    case "blocked_schema_unsupported":
      return "Blokkert: dagens schema støtter ikke denne kategorien";
    case "unchanged":
      return "Ingen endring";
    case "failed":
      return "Blokkert";
    default:
      return status;
  }
}

function diffCatalogItems(
  existing: Array<{ key: string; title: string; description?: string | null; allergens?: string[] | null }>,
  generated: FullApplyMenuItem[],
  overwriteMode: ApplyOverwriteMode,
  schemaUnsupported: boolean,
): FullApplyCategoryDiff {
  const categoryKey = generated[0]?.categoryKey ?? ("sandwich" as FixedCategoryKey);
  const displayName = generated[0] ? generated[0].title : categoryKey;

  if (schemaUnsupported) {
    return {
      categoryKey,
      displayName,
      schemaSupport: "unsupported",
      writeTarget: "unsupported",
      status: "blocked_schema_unsupported",
      existingItemCount: existing.length,
      generatedItemCount: generated.length,
      addedItems: generated.map((g) => g.sourceDishSlug),
      removedItems: [],
      changedItems: [],
      unchangedItems: [],
      itemChanges: generated.map((g) => ({
        slug: g.sourceDishSlug,
        title: g.title,
        change: "added" as const,
        titleChanged: true,
        descriptionChanged: true,
        allergenChanged: true,
      })),
      warnings: [],
      blockedReason: "Schema støtter ikke denne kategorien.",
      providerLabel: providerLabelForStatus("blocked_schema_unsupported"),
    };
  }

  const existingBySlug = new Map(existing.map((e) => [e.key.toLowerCase(), e]));
  const generatedBySlug = new Map(generated.map((g) => [g.sourceDishSlug.toLowerCase(), g]));

  const addedItems: string[] = [];
  const changedItems: string[] = [];
  const unchangedItems: string[] = [];
  const itemChanges: FullApplyItemChange[] = [];

  for (const [slug, gen] of generatedBySlug) {
    const ex = existingBySlug.get(slug);
    if (!ex) {
      addedItems.push(slug);
      itemChanges.push({
        slug,
        title: gen.title,
        change: "added",
        titleChanged: true,
        descriptionChanged: true,
        allergenChanged: true,
      });
      continue;
    }
    const titleChanged = ex.title.trim() !== gen.title.trim();
    const descChanged = String(ex.description ?? "").trim() !== gen.description.trim();
    const allergenChanged =
      normalizeAllergenListForCompare(ex.allergens ?? []) !==
      normalizeAllergenListForCompare(gen.allergens);
    if (titleChanged || descChanged || allergenChanged) {
      changedItems.push(slug);
      itemChanges.push({
        slug,
        title: gen.title,
        change: "changed",
        titleChanged,
        descriptionChanged: descChanged,
        allergenChanged,
      });
    } else {
      unchangedItems.push(slug);
      itemChanges.push({
        slug,
        title: gen.title,
        change: "unchanged",
        titleChanged: false,
        descriptionChanged: false,
        allergenChanged: false,
      });
    }
  }

  let status: FullApplyCategoryStatus = "unchanged";
  if (addedItems.length && !existing.length) status = "would_create_category";
  else if (addedItems.length || changedItems.length) {
    status = overwriteMode === "replace_drafts_only" ? "would_replace_draft_category" : "would_update_category";
  } else if (unchangedItems.length && !addedItems.length && !changedItems.length) {
    status = overwriteMode === "create_missing_only" && existing.length ? "would_skip_existing_category" : "unchanged";
  }

  if (overwriteMode === "create_missing_only" && existing.length && addedItems.length === 0 && changedItems.length === 0) {
    status = "would_skip_existing_category";
  }

  return {
    categoryKey,
    displayName: generated[0]?.categoryKey ? displayName : categoryKey,
    schemaSupport: "supported",
    writeTarget: "lunchCategory",
    status,
    existingItemCount: existing.length,
    generatedItemCount: generated.length,
    addedItems,
    removedItems: [],
    changedItems,
    unchangedItems,
    itemChanges,
    warnings: [],
    blockedReason: null,
    providerLabel: providerLabelForStatus(status),
  };
}

function hotMealToVarmrettState(item: FullApplyMenuItem): ApplyGeneratedVarmrettState {
  return {
    mealTitle: item.title,
    description: item.description,
    allergensText: item.allergens.join(", "),
    itemKey: item.itemKey,
    slug: item.sourceDishSlug,
    hotMealBaseItemKey: item.enterpriseUpgradeBaseItemKey,
    isPremiumUpgrade: item.isPremiumUpgrade,
  };
}

export function buildFullApplyDiff(input: {
  draft: FullLocalizedGeneratedWeekMenuDraft;
  existingRows: readonly ProviderMenuDayRow[];
  catalog: ProviderMenuCatalogSnapshot;
  overwriteMode: ApplyOverwriteMode;
  lockState: ProviderOrderLockState;
  categoryScope: "all_supported" | "fixed_categories_only" | "hotMeal_only";
}): FullApplyDiffResult {
  const dates = input.draft.days.map((d) => d.date);
  const varmrettByDate = new Map<string, ApplyGeneratedVarmrettState>();

  for (const day of input.draft.days) {
    const hot = day.categories.find((c) => c.categoryKey === "hotMeal")?.items[0];
    if (hot) varmrettByDate.set(day.date, hotMealToVarmrettState(hot));
  }

  const varmrettDiff = buildApplyWeekDiff({
    weekStart: input.draft.weekStart,
    dates,
    existingRows: input.existingRows,
    varmrettByDate,
    overwriteMode: input.overwriteMode,
    dryRun: true,
    lockState: input.lockState,
  });

  const catalogCategories: FullApplyCategoryDiff[] = [];

  for (const catDraft of input.draft.catalogCategories) {
    if (input.categoryScope === "hotMeal_only") continue;
    if (catDraft.schemaSupport === "unsupported") {
      catalogCategories.push(
        diffCatalogItems([], catDraft.items, input.overwriteMode, true),
      );
      continue;
    }

    const lunchKey = lunchCategoryKeyForFixed(catDraft.categoryKey);
    if (!lunchKey) continue;

    const runtimeCategory = categoryFromLunchCategoryKey(lunchKey);
    const row = runtimeCategory ? categoryRowForCategory(input.catalog, runtimeCategory) : null;
    const existing = (row?.items ?? []).map((i) => ({
      key: i.key,
      title: i.title,
      description: i.description,
      allergens: i.allergens ?? [],
    }));

    const diff = diffCatalogItems(existing, catDraft.items, input.overwriteMode, false);
    diff.displayName = catDraft.displayName;
    diff.categoryKey = catDraft.categoryKey;
    catalogCategories.push(diff);
  }

  const days: FullApplyDayDiff[] = input.draft.days.map((day, idx) => {
    const varmrettDay = varmrettDiff.days[idx];
    const dayCategories: FullApplyCategoryDiff[] = [];

    for (const cat of day.categories) {
      if (cat.categoryKey === "hotMeal") {
        const vd = varmrettDay;
        dayCategories.push({
          categoryKey: "hotMeal",
          displayName: cat.displayName,
          schemaSupport: "supported",
          writeTarget: "menuDay",
          status:
            vd?.status === "would_create"
              ? "would_create_category"
              : vd?.status === "would_update_draft"
                ? "would_update_category"
                : vd?.status === "skipped_published" || vd?.status === "blocked_published"
                  ? "blocked_published_category"
                  : vd?.status === "skipped_existing"
                    ? "would_skip_existing_category"
                    : vd?.status === "unchanged"
                      ? "unchanged"
                      : vd?.status === "failed"
                        ? "failed"
                        : "unchanged",
          existingItemCount: vd ? 1 : 0,
          generatedItemCount: cat.items.length,
          addedItems: vd?.status === "would_create" ? [cat.items[0]?.sourceDishSlug ?? ""] : [],
          removedItems: [],
          changedItems: vd?.status === "would_update_draft" ? [cat.items[0]?.sourceDishSlug ?? ""] : [],
          unchangedItems: vd?.status === "unchanged" ? [cat.items[0]?.sourceDishSlug ?? ""] : [],
          itemChanges: cat.items.map((i) => ({
            slug: i.sourceDishSlug,
            title: i.title,
            change: vd?.status === "unchanged" ? "unchanged" : "changed",
            titleChanged: Boolean(vd?.diff.some((d) => d.field === "mealTitle")),
            descriptionChanged: Boolean(vd?.diff.some((d) => d.field === "description")),
            allergenChanged: Boolean(vd?.diff.some((d) => d.field === "allergens")),
          })),
          warnings: vd?.warnings ?? [],
          blockedReason: vd?.status === "blocked_published" ? "Publisert varmrett finnes." : null,
          providerLabel: vd?.providerLabel ?? "Ingen endring",
        });
        continue;
      }

      if (cat.schemaSupport === "unsupported") {
        dayCategories.push(diffCatalogItems([], cat.items, input.overwriteMode, true));
        continue;
      }

      if (input.categoryScope === "hotMeal_only") continue;

      const weekCat = catalogCategories.find((c) => c.categoryKey === cat.categoryKey);
      if (weekCat) {
        dayCategories.push({ ...weekCat, generatedItemCount: cat.items.length });
      }
    }

    return {
      date: day.date,
      weekday: day.weekday,
      dayStatus: varmrettDay?.status ?? "unchanged",
      existingState: varmrettDay?.existingState ?? "missing",
      categories: dayCategories,
      varmrett: dayCategories.find((c) => c.categoryKey === "hotMeal") ?? null,
    };
  });

  const countStatus = (pred: (s: FullApplyCategoryStatus) => boolean) =>
    catalogCategories.filter((c) => pred(c.status)).length +
    days.reduce((n, d) => n + d.categories.filter((c) => c.categoryKey === "hotMeal" && pred(c.status)).length, 0);

  const totalItems =
    input.draft.catalogCategories.reduce((n, c) => n + c.items.length, 0) +
    input.draft.days.reduce((n, d) => n + d.categories.filter((c) => c.categoryKey === "hotMeal").reduce((m, c) => m + c.items.length, 0), 0);

  const summary: FullApplySummary = {
    createdDraftDays: varmrettDiff.days.filter((d) => d.status === "would_create").length,
    updatedDraftDays: varmrettDiff.days.filter((d) => d.status === "would_update_draft").length,
    createdCategories: countStatus((s) => s === "would_create_category"),
    updatedCategories: countStatus((s) => s === "would_update_category" || s === "would_replace_draft_category"),
    skippedExistingCategories: countStatus((s) => s === "would_skip_existing_category"),
    skippedPublishedCategories: countStatus((s) => s === "would_skip_published_category"),
    blockedPublishedCategories: countStatus((s) => s === "blocked_published_category"),
    unsupportedCategories: countStatus((s) => s === "blocked_schema_unsupported"),
    unchangedCategories: countStatus((s) => s === "unchanged"),
    totalGeneratedDays: input.draft.days.length,
    totalGeneratedCategories: input.draft.catalogCategories.length + input.draft.days.length,
    totalGeneratedItems: totalItems,
    failedDays: varmrettDiff.days.filter((d) => d.status === "failed").length,
  };

  return {
    days,
    catalogCategories,
    summary,
    warnings: [...varmrettDiff.warnings, ...input.draft.capabilities.warnings],
    blockedReasons: varmrettDiff.blockedReasons,
    varmrettByDate,
  };
}

export function fullApplyWouldMutate(diff: FullApplyDiffResult): boolean {
  const mutable = new Set<FullApplyCategoryStatus>([
    "would_create_category",
    "would_update_category",
    "would_replace_draft_category",
  ]);
  if (diff.catalogCategories.some((c) => mutable.has(c.status))) return true;
  if (diff.days.some((d) => d.categories.some((c) => mutable.has(c.status)))) return true;
  return diff.summary.createdDraftDays > 0 || diff.summary.updatedDraftDays > 0;
}
