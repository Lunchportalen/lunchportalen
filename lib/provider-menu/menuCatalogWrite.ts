// lib/provider-menu/menuCatalogWrite.ts
// Copy-on-write provider lunchCategory persistence (Sanity).

import "server-only";

import type { SanityClient } from "@sanity/client";

import {
  categoryTiersForEditableKey,
  EDITABLE_LUNCH_CATEGORY_KEYS,
  fetchLunchCategoryRowsForProvider,
  fetchLunchCategoryTemplateRows,
  isEditableLunchCategoryKey,
  providerLunchCategoryDocId,
  type LunchCategorySanityRow,
} from "@/lib/cms/lunchCategory";
import {
  LUNCH_CATEGORY_ALLERGENS,
  type EditableLunchCategoryKey,
} from "@/lib/provider-menu/lunchCategoryCatalog";
import { buildMenuCatalogSnapshot } from "@/lib/provider-menu/providerMenuCatalogReadModel";
import { sanityServer } from "@/lib/sanity/server";

import { CATALOG_WEEK_PUBLISH_HINT } from "@/lib/provider-menu/lunchCategoryCatalog";

export type MenuCatalogWriteItemInput = {
  /** Immutable slug for existing items. Omit for new items (server generates slug). */
  key?: string | null;
  title: string;
  description?: string | null;
  allergens?: string[] | null;
  isVegetarian?: boolean | null;
};

export type MenuCatalogWriteInput = {
  categoryKey: string;
  items: MenuCatalogWriteItemInput[];
};

type SanityCategoryItem = {
  _key: string;
  _type: "categoryItem";
  slug: { _type: "slug"; current: string };
  title: string;
  description?: string;
  allergens?: string[];
  isVegetarian?: boolean;
  allowedPlanTiers: string[];
};

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

function slugifyTitle(title: string): string {
  const s = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return s || "valg";
}

function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base;
  let n = 2;
  while (used.has(slug)) {
    const suffix = `-${n}`;
    slug = `${base.slice(0, 64 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

function normalizeAllergens(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const allow = new Set<string>(LUNCH_CATEGORY_ALLERGENS);
  const out: string[] = [];
  for (const a of raw) {
    const v = safeTrim(a).toLowerCase();
    if (!v || !allow.has(v)) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

type TemplateDoc = LunchCategorySanityRow & {
  displayOrder?: number | null;
};

async function fetchTemplateDoc(categoryKey: string): Promise<TemplateDoc | null> {
  const rows = await fetchLunchCategoryTemplateRows();
  const hit = rows.find((r) => safeTrim(r.key).toLowerCase() === categoryKey);
  return hit ?? null;
}

async function fetchProviderCategoryDoc(
  providerId: string,
  categoryKey: string,
): Promise<LunchCategorySanityRow | null> {
  const docId = providerLunchCategoryDocId(providerId, categoryKey);
  const row = await sanityServer.fetch<LunchCategorySanityRow | null>(
    `*[_id == $id][0] ${`{
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
    }`}`,
    { id: docId },
  );
  return row ?? null;
}

function existingItemKeys(row: LunchCategorySanityRow | null): Set<string> {
  const keys = new Set<string>();
  if (!Array.isArray(row?.items)) return keys;
  for (const item of row.items as Record<string, unknown>[]) {
    const k = safeTrim(item.key);
    if (k) keys.add(k.toLowerCase());
  }
  return keys;
}

function itemsFromTemplateOrProvider(
  template: TemplateDoc,
  providerDoc: LunchCategorySanityRow | null,
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  const source = providerDoc ?? template;
  if (!Array.isArray(source.items)) return map;
  for (const raw of source.items as Record<string, unknown>[]) {
    const k = safeTrim(raw.key).toLowerCase();
    if (k) map.set(k, raw);
  }
  return map;
}

export type MenuCatalogWriteValidationError = {
  ok: false;
  message: string;
  field?: string;
};

export function validateMenuCatalogWriteInput(input: MenuCatalogWriteInput): MenuCatalogWriteValidationError | null {
  const categoryKey = safeTrim(input.categoryKey).toLowerCase();
  if (!isEditableLunchCategoryKey(categoryKey)) {
    return { ok: false, message: "Kategori kan ikke redigeres.", field: "categoryKey" };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, message: "Minst ett valg er påkrevd.", field: "items" };
  }

  for (let i = 0; i < input.items.length; i += 1) {
    const item = input.items[i];
    const title = safeTrim(item?.title);
    if (!title) {
      return { ok: false, message: `Valg ${i + 1}: tittel er påkrevd.`, field: `items[${i}].title` };
    }
    if (title.length > 120) {
      return { ok: false, message: `Valg ${i + 1}: tittel er for lang.`, field: `items[${i}].title` };
    }
  }

  return null;
}

export type ProviderLunchCategoryWriteDoc = {
  _id: string;
  _type: "lunchCategory";
  provider: { _type: "reference"; _ref: string };
  key: { _type: "slug"; current: string };
  title: string;
  displayOrder: number;
  allowedPlanTiers: string[];
  isActive: boolean;
  items: SanityCategoryItem[];
};

export async function buildProviderLunchCategoryDoc(
  providerId: string,
  input: MenuCatalogWriteInput,
): Promise<{ doc: ProviderLunchCategoryWriteDoc; catalog: ReturnType<typeof buildMenuCatalogSnapshot> }> {
  const validation = validateMenuCatalogWriteInput(input);
  if (validation) throw new MenuCatalogWriteError(validation.message, validation.field);

  const categoryKey = safeTrim(input.categoryKey).toLowerCase();
  const template = await fetchTemplateDoc(categoryKey);
  if (!template) {
    throw new MenuCatalogWriteError("Mal for kategori finnes ikke.", "categoryKey");
  }

  const providerDoc = await fetchProviderCategoryDoc(providerId, categoryKey);
  const baselineItems = itemsFromTemplateOrProvider(template, providerDoc);
  const existingKeys = existingItemKeys(providerDoc ?? template);
  const usedSlugs = new Set<string>();
  const categoryTiers = categoryTiersForEditableKey(categoryKey);
  const sanityItems: SanityCategoryItem[] = [];

  for (const raw of input.items) {
    const title = safeTrim(raw.title);
    const keyInput = safeTrim(raw.key).toLowerCase();
    let slugCurrent: string;

    if (keyInput) {
      if (!existingKeys.has(keyInput) && !baselineItems.has(keyInput)) {
        throw new MenuCatalogWriteError(`Ukjent valg-nøkkel: ${keyInput}`, "items");
      }
      slugCurrent = keyInput;
      usedSlugs.add(slugCurrent);
    } else {
      const base = slugifyTitle(title);
      slugCurrent = uniqueSlug(base, usedSlugs);
    }

    const desc = safeTrim(raw.description);
    sanityItems.push({
      _key: slugCurrent.replace(/[^a-z0-9-]/gi, "-").slice(0, 64),
      _type: "categoryItem",
      slug: { _type: "slug", current: slugCurrent },
      title,
      ...(desc ? { description: desc } : {}),
      allergens: normalizeAllergens(raw.allergens),
      isVegetarian: raw.isVegetarian === true,
      allowedPlanTiers: [...categoryTiers],
    });
  }

  const displayOrder =
    typeof template.displayOrder === "number" && Number.isFinite(template.displayOrder)
      ? template.displayOrder
      : (EDITABLE_LUNCH_CATEGORY_KEYS as readonly string[]).indexOf(categoryKey) + 1;

  const docId = providerLunchCategoryDocId(providerId, categoryKey);
  const doc = {
    _id: docId,
    _type: "lunchCategory" as const,
    provider: { _type: "reference" as const, _ref: providerId },
    key: { _type: "slug" as const, current: categoryKey },
    title: safeTrim(template.title) || categoryKey,
    displayOrder,
    allowedPlanTiers: Array.isArray(template.allowedPlanTiers)
      ? template.allowedPlanTiers.map((t) => String(t))
      : [...categoryTiers],
    isActive: true,
    items: sanityItems,
  };

  const mergedRows = await fetchLunchCategoryRowsForProvider(providerId);
  return { doc, catalog: buildMenuCatalogSnapshot(mergedRows) };
}

export class MenuCatalogWriteError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "MenuCatalogWriteError";
    this.field = field;
  }
}

export async function persistProviderMenuCatalog(
  writeClient: SanityClient,
  providerId: string,
  input: MenuCatalogWriteInput,
): Promise<{ catalog: ReturnType<typeof buildMenuCatalogSnapshot> }> {
  const { doc, catalog } = await buildProviderLunchCategoryDoc(providerId, input);
  await writeClient.createOrReplace(doc);
  const freshRows = await fetchLunchCategoryRowsForProvider(providerId);
  return { catalog: buildMenuCatalogSnapshot(freshRows) };
}
