/**
 * Execute catalog writes for full localized week menu apply.
 */

import "server-only";

import type { SanityClient } from "@sanity/client";

import { lunchCategoryKeyForFixed } from "@/lib/menu-generator/applyCapabilities";
import type { FullApplyCategoryDiff } from "@/lib/menu-generator/fullApplyDiff";
import type { FullApplyMenuItem } from "@/lib/menu-generator/fullApplyDomain";
import type { ApplyOverwriteMode } from "@/lib/menu-generator/applyTypes";
import type { FixedCategoryKey } from "@/lib/menu-generator/types";
import {
  persistProviderMenuCatalog,
  type MenuCatalogWriteInput,
} from "@/lib/provider-menu/menuCatalogWrite";
import type { ProviderMenuCatalogSnapshot } from "@/lib/provider-menu/lunchCategoryCatalog";
import { categoryFromLunchCategoryKey, categoryRowForCategory } from "@/lib/provider-menu/lunchCategoryCatalog";

function toCatalogWriteItem(
  item: {
    key: string;
    title: string;
    description?: string | null;
    allergens?: string[] | null;
    isVegetarian?: boolean | null;
  },
  existingKeySet: Set<string>,
): MenuCatalogWriteInput["items"][number] {
  const normalizedKey = item.key.toLowerCase();
  return {
    // Existing catalog keys must be preserved; new localized generator dishes get slug-from-title.
    key: existingKeySet.has(normalizedKey) ? item.key : "",
    title: item.title,
    description: item.description ?? "",
    allergens: item.allergens ?? [],
    isVegetarian: item.isVegetarian,
  };
}

function mergeCatalogItems(
  existing: Array<{ key: string; title: string; description?: string | null; allergens?: string[] | null; isVegetarian?: boolean | null }>,
  generated: FullApplyMenuItem[],
  overwriteMode: ApplyOverwriteMode,
): MenuCatalogWriteInput["items"] {
  const existingKeySet = new Set(existing.map((e) => e.key.toLowerCase()));
  const byKey = new Map(existing.map((e) => [e.key.toLowerCase(), e]));

  for (const gen of generated) {
    const slug = gen.sourceDishSlug.toLowerCase();
    const prev = byKey.get(slug);
    if (!prev && overwriteMode === "create_missing_only") {
      byKey.set(slug, {
        key: slug,
        title: gen.title,
        description: gen.description,
        allergens: [...gen.allergens],
        isVegetarian: gen.categoryKey === "vegetarian" || gen.tags.includes("vegetarian"),
      });
      continue;
    }
    if (prev && overwriteMode === "create_missing_only") continue;

    byKey.set(slug, {
      key: slug,
      title: gen.title,
      description: gen.description,
      allergens: [...gen.allergens],
      isVegetarian: gen.categoryKey === "vegetarian" || gen.tags.includes("vegetarian"),
    });
  }

  if (overwriteMode === "create_missing_only") {
    return [...byKey.values()].map((item) => toCatalogWriteItem(item, existingKeySet));
  }

  const generatedSlugs = new Set(generated.map((g) => g.sourceDishSlug.toLowerCase()));
  const merged = [...byKey.values()].filter((item) => {
    if (generatedSlugs.has(item.key.toLowerCase())) return true;
    return overwriteMode !== "replace_drafts_only";
  });

  for (const gen of generated) {
    const slug = gen.sourceDishSlug.toLowerCase();
    if (!merged.some((m) => m.key.toLowerCase() === slug)) {
      merged.push({
        key: slug,
        title: gen.title,
        description: gen.description,
        allergens: [...gen.allergens],
        isVegetarian: gen.tags.includes("vegetarian"),
      });
    }
  }

  return merged.map((item) => toCatalogWriteItem(item, existingKeySet));
}

export async function applyCatalogCategories(input: {
  client: SanityClient;
  providerId: string;
  catalog: ProviderMenuCatalogSnapshot;
  catalogDiffs: FullApplyCategoryDiff[];
  generatedByCategory: Map<FixedCategoryKey, FullApplyMenuItem[]>;
  overwriteMode: ApplyOverwriteMode;
}): Promise<{ applied: FixedCategoryKey[]; errors: Array<{ categoryKey: FixedCategoryKey; error: string }> }> {
  const applied: FixedCategoryKey[] = [];
  const errors: Array<{ categoryKey: FixedCategoryKey; error: string }> = [];

  for (const diff of input.catalogDiffs) {
    if (
      diff.status !== "would_create_category" &&
      diff.status !== "would_update_category" &&
      diff.status !== "would_replace_draft_category"
    ) {
      continue;
    }

    const lunchKey = lunchCategoryKeyForFixed(diff.categoryKey);
    if (!lunchKey) continue;

    const generated = input.generatedByCategory.get(diff.categoryKey) ?? [];
    if (!generated.length) continue;

    const runtimeCategory = categoryFromLunchCategoryKey(lunchKey);
    const row = runtimeCategory ? categoryRowForCategory(input.catalog, runtimeCategory) : null;
    const existing = (row?.items ?? []).map((i) => ({
      key: i.key,
      title: i.title,
      description: i.description,
      allergens: i.allergens ?? [],
      isVegetarian: i.isVegetarian,
    }));

    const items = mergeCatalogItems(existing, generated, input.overwriteMode);
    if (!items.length) continue;

    try {
      await persistProviderMenuCatalog(input.client, input.providerId, {
        categoryKey: lunchKey,
        items,
      });
      applied.push(diff.categoryKey);
    } catch (e) {
      errors.push({
        categoryKey: diff.categoryKey,
        error: e instanceof Error ? e.message : "Katalogskriving feilet.",
      });
    }
  }

  return { applied, errors };
}
