/**
 * SMART-3 — read-only employee approved translation overlay (server-only).
 * Display text only; never mutates order identity, Sanity, or provider publish runtime.
 */
import "server-only";

import type { NextRequest } from "next/server";

import { resolveAppLocale } from "@/lib/i18n/resolveAppLocale";
import { loadProfilePreferredLocaleForRequest } from "@/lib/i18n/profileLocale";
import { LP_LOCALE_COOKIE, type AppLocale } from "@/lib/i18n/middlewareLocale";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";
import {
  hashOriginalText,
  isEmployeeVisibleTranslation,
  originalTextHashMatches,
  type MenuContentField,
  type MenuContentSourceKind,
  type MenuContentTranslationStatus,
} from "@/lib/smart-menu/translationStatus";

const TABLE = "menu_content_translations" as const;

type TranslationRow = Database["public"]["Tables"]["menu_content_translations"]["Row"];

export type EmployeeTranslationSource = {
  sourceKind: MenuContentSourceKind;
  sourceRef: string;
  field: MenuContentField;
  originalText: string;
};

export type EmployeeApprovedTranslationOverlay = {
  displayText: string;
  translated: boolean;
};

export type OrderWindowCategoryItemForOverlay = {
  key: string;
  title: string;
  description?: string;
  allergens: string[];
  isVegetarian?: boolean;
};

export type OrderWindowCategoryForOverlay = {
  key: string;
  category: string | null;
  label: string;
  title: string | null;
  description: string | null;
  allergens: string[];
  available: boolean;
  items: OrderWindowCategoryItemForOverlay[];
};

export type OrderWindowDayForOverlay = {
  date: string;
  menuTitle?: string | null;
  menuDescription?: string | null;
  allergens?: string[];
  categories: OrderWindowCategoryForOverlay[];
  [key: string]: unknown;
};

/** Stable ref for menu_day_item rows — matches SMART-2 manual item.key convention. */
export function sourceRefForMenuDayItem(itemKey: string): string {
  return String(itemKey).trim();
}

/** Stable ref for category_label rows — category slug (not order choice key). */
export function sourceRefForCategoryLabel(categorySlug: string): string {
  return String(categorySlug).trim().toLowerCase();
}

/** Stable ref for menu_day category/day header rows. */
export function menuDaySourceRef(isoDate: string, suffix: string): string {
  return `${String(isoDate).trim()}:${String(suffix).trim().toLowerCase()}`;
}

/** Stable ref for allergen_label rows. */
export function normalizeAllergenSourceRef(allergen: string): string {
  return String(allergen).trim().toLowerCase();
}

export function translationLookupKey(parts: {
  sourceKind: MenuContentSourceKind;
  sourceRef: string;
  field: MenuContentField;
}): string {
  return `${parts.sourceKind}\u001f${parts.sourceRef}\u001f${parts.field}`;
}

export function resolveEmployeeDisplayText(
  originalText: string,
  row: Pick<TranslationRow, "status" | "original_text_hash" | "translated_text"> | null | undefined,
): EmployeeApprovedTranslationOverlay {
  const original = String(originalText ?? "").trim();
  if (!original) {
    return { displayText: original, translated: false };
  }

  if (!row) {
    return { displayText: original, translated: false };
  }

  const status = row.status as MenuContentTranslationStatus;
  const hashMatches = originalTextHashMatches(row.original_text_hash, original);
  const translatedText = row.translated_text != null ? String(row.translated_text).trim() : "";

  if (
    !isEmployeeVisibleTranslation(status, hashMatches) ||
    translatedText.length === 0
  ) {
    return { displayText: original, translated: false };
  }

  return { displayText: translatedText, translated: true };
}

function overlayFromLookup(
  originalText: string,
  lookup: Map<string, EmployeeApprovedTranslationOverlay>,
  parts: { sourceKind: MenuContentSourceKind; sourceRef: string; field: MenuContentField },
): string {
  const key = translationLookupKey(parts);
  const overlay = lookup.get(key);
  if (!overlay) {
    return resolveEmployeeDisplayText(originalText, null).displayText;
  }
  if (overlay.translated) {
    return overlay.displayText;
  }
  return resolveEmployeeDisplayText(originalText, null).displayText;
}

export function collectTranslationSourcesFromOrderWindowDay(day: OrderWindowDayForOverlay): EmployeeTranslationSource[] {
  const sources: EmployeeTranslationSource[] = [];
  const date = String(day.date).trim();

  const push = (
    sourceKind: MenuContentSourceKind,
    sourceRef: string,
    field: MenuContentField,
    originalText: string | null | undefined,
  ) => {
    const text = String(originalText ?? "").trim();
    if (!text) return;
    sources.push({ sourceKind, sourceRef, field, originalText: text });
  };

  push("menu_day", menuDaySourceRef(date, "header"), "title", day.menuTitle);
  push("menu_day", menuDaySourceRef(date, "header"), "description", day.menuDescription);

  for (const allergen of day.allergens ?? []) {
    push("allergen_label", normalizeAllergenSourceRef(allergen), "label", allergen);
  }

  for (const cat of day.categories ?? []) {
    const categorySlug = cat.category != null ? sourceRefForCategoryLabel(cat.category) : null;

    if (categorySlug) {
      push("category_label", categorySlug, "label", cat.label);
      push("menu_day", menuDaySourceRef(date, categorySlug), "title", cat.title);
      push("menu_day", menuDaySourceRef(date, categorySlug), "description", cat.description);
    }

    for (const allergen of cat.allergens ?? []) {
      push("allergen_label", normalizeAllergenSourceRef(allergen), "label", allergen);
    }

    for (const item of cat.items ?? []) {
      const itemRef = sourceRefForMenuDayItem(item.key);
      push("menu_day_item", itemRef, "title", item.title);
      push("menu_day_item", itemRef, "description", item.description);
      for (const allergen of item.allergens ?? []) {
        push("allergen_label", normalizeAllergenSourceRef(allergen), "label", allergen);
      }
    }
  }

  return sources;
}

export function buildTranslationLookupFromRows(
  sources: EmployeeTranslationSource[],
  rows: TranslationRow[],
): Map<string, EmployeeApprovedTranslationOverlay> {
  const needed = new Map<string, EmployeeTranslationSource>();
  for (const source of sources) {
    needed.set(translationLookupKey(source), source);
  }

  const lookup = new Map<string, EmployeeApprovedTranslationOverlay>();

  for (const source of sources) {
    const key = translationLookupKey(source);
    if (lookup.has(key)) continue;
    lookup.set(key, resolveEmployeeDisplayText(source.originalText, null));
  }

  for (const row of rows) {
    const key = translationLookupKey({
      sourceKind: row.source_kind as MenuContentSourceKind,
      sourceRef: row.source_ref,
      field: row.field as MenuContentField,
    });
    const source = needed.get(key);
    if (!source) continue;
    lookup.set(key, resolveEmployeeDisplayText(source.originalText, row));
  }

  return lookup;
}

export async function loadApprovedTranslationRows(params: {
  providerId: string;
  locale: AppLocale;
  sources: EmployeeTranslationSource[];
}): Promise<TranslationRow[]> {
  const { providerId, locale, sources } = params;
  if (!providerId || sources.length === 0) return [];

  const sourceRefs = [...new Set(sources.map((s) => s.sourceRef))];
  if (sourceRefs.length === 0) return [];

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .select("status, original_text_hash, translated_text, source_kind, source_ref, field")
    .eq("provider_id", providerId)
    .eq("locale", locale)
    .eq("status", "approved")
    .in("source_ref", sourceRefs);

  if (error || !Array.isArray(data)) return [];
  return data as TranslationRow[];
}

export async function loadApprovedTranslationLookup(params: {
  providerId: string;
  locale: AppLocale;
  sources: EmployeeTranslationSource[];
}): Promise<Map<string, EmployeeApprovedTranslationOverlay>> {
  const rows = await loadApprovedTranslationRows(params);
  return buildTranslationLookupFromRows(params.sources, rows);
}

export function applyApprovedTranslationsToOrderWindowDays<T extends OrderWindowDayForOverlay>(
  days: T[],
  lookup: Map<string, EmployeeApprovedTranslationOverlay>,
): T[] {
  if (lookup.size === 0) return days;

  return days.map((day) => {
    const date = String(day.date).trim();
    const categories = (day.categories ?? []).map((cat) => {
      const categorySlug = cat.category != null ? sourceRefForCategoryLabel(cat.category) : null;
      const label =
        categorySlug != null
          ? overlayFromLookup(cat.label, lookup, {
              sourceKind: "category_label",
              sourceRef: categorySlug,
              field: "label",
            })
          : cat.label;
      const title =
        categorySlug != null
          ? overlayFromLookup(cat.title ?? "", lookup, {
              sourceKind: "menu_day",
              sourceRef: menuDaySourceRef(date, categorySlug),
              field: "title",
            }) || cat.title
          : cat.title;
      const description =
        categorySlug != null && cat.description
          ? overlayFromLookup(cat.description, lookup, {
              sourceKind: "menu_day",
              sourceRef: menuDaySourceRef(date, categorySlug),
              field: "description",
            }) || cat.description
          : cat.description;

      const catAllergens = (cat.allergens ?? []).map((allergen) =>
        overlayFromLookup(allergen, lookup, {
          sourceKind: "allergen_label",
          sourceRef: normalizeAllergenSourceRef(allergen),
          field: "label",
        }),
      );

      const items = (cat.items ?? []).map((item) => {
        const itemRef = sourceRefForMenuDayItem(item.key);
        return {
          ...item,
          title: overlayFromLookup(item.title, lookup, {
            sourceKind: "menu_day_item",
            sourceRef: itemRef,
            field: "title",
          }),
          description: item.description
            ? overlayFromLookup(item.description, lookup, {
                sourceKind: "menu_day_item",
                sourceRef: itemRef,
                field: "description",
              })
            : item.description,
          allergens: (item.allergens ?? []).map((allergen) =>
            overlayFromLookup(allergen, lookup, {
              sourceKind: "allergen_label",
              sourceRef: normalizeAllergenSourceRef(allergen),
              field: "label",
            }),
          ),
        };
      });

      return {
        ...cat,
        label,
        title: title && String(title).trim().length ? title : cat.title,
        description:
          description && String(description).trim().length ? description : cat.description,
        allergens: catAllergens,
        items,
      };
    });

    const menuTitle = day.menuTitle
      ? overlayFromLookup(day.menuTitle, lookup, {
          sourceKind: "menu_day",
          sourceRef: menuDaySourceRef(date, "header"),
          field: "title",
        }) || day.menuTitle
      : day.menuTitle;

    const menuDescription = day.menuDescription
      ? overlayFromLookup(day.menuDescription, lookup, {
          sourceKind: "menu_day",
          sourceRef: menuDaySourceRef(date, "header"),
          field: "description",
        }) || day.menuDescription
      : day.menuDescription;

    const allergens = (day.allergens ?? []).map((allergen) =>
      overlayFromLookup(allergen, lookup, {
        sourceKind: "allergen_label",
        sourceRef: normalizeAllergenSourceRef(allergen),
        field: "label",
      }),
    );

    return {
      ...day,
      menuTitle,
      menuDescription,
      allergens,
      categories,
    };
  });
}

export async function overlayApprovedTranslationsOnOrderWindowDays<T extends OrderWindowDayForOverlay>(params: {
  days: T[];
  providerId: string;
  locale: AppLocale;
}): Promise<T[]> {
  const sources = params.days.flatMap((day) => collectTranslationSourcesFromOrderWindowDay(day));
  if (sources.length === 0) return params.days;

  const lookup = await loadApprovedTranslationLookup({
    providerId: params.providerId,
    locale: params.locale,
    sources,
  });

  return applyApprovedTranslationsToOrderWindowDays(params.days, lookup);
}

/** Employee display locale — cookie → profile → nb. Display overlay only. */
export async function resolveEmployeeDisplayLocaleFromRequest(req: NextRequest): Promise<AppLocale> {
  const cookie = req.cookies.get(LP_LOCALE_COOKIE)?.value ?? null;
  const profile = await loadProfilePreferredLocaleForRequest();
  return resolveAppLocale({ cookie, profile });
}

/** @internal test helper — hash without exposing row metadata to clients */
export function __testHashOriginalText(text: string): string {
  return hashOriginalText(text);
}
