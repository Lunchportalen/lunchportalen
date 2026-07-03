/**
 * SMART-4 — provider-side translation source extraction (pure helpers).
 * Never mutates Sanity, employee runtime, or order identity.
 */
import type { AppLocale } from "@/lib/i18n/localeRegistry";
import { APP_LOCALES } from "@/lib/i18n/localeRegistry";
import {
  categoryFromLunchCategoryKey,
  categoryLabelFromCatalog,
  type ProviderMenuCatalogSnapshot,
} from "@/lib/provider-menu/lunchCategoryCatalog";
import {
  collectTranslationSourcesFromOrderWindowDay,
  normalizeAllergenSourceRef,
  sourceRefForCategoryLabel,
  sourceRefForMenuDayItem,
  type OrderWindowDayForOverlay,
} from "@/lib/smart-menu/employeeApprovedTranslations";
import {
  hashOriginalText,
  type MenuContentField,
  type MenuContentSourceKind,
} from "@/lib/smart-menu/translationStatus";

export type MenuTranslationSourceCandidate = {
  provider_id: string;
  source_kind: MenuContentSourceKind;
  source_ref: string;
  field: MenuContentField;
  locale?: AppLocale;
  original_text: string;
  original_text_hash: string;
};

/** Target locales for provider translation coverage (original text is provider/NB). */
export const MENU_TRANSLATION_TARGET_LOCALES = APP_LOCALES.filter(
  (locale): locale is AppLocale => locale !== "nb",
);

export function translationSourceCandidateKey(
  candidate: Pick<MenuTranslationSourceCandidate, "source_kind" | "source_ref" | "field">,
): string {
  return `${candidate.source_kind}\u001f${candidate.source_ref}\u001f${candidate.field}`;
}

/** Stable refs only — skip blank/unstable identifiers. */
export function isStableSourceRef(sourceRef: string): boolean {
  const ref = String(sourceRef ?? "").trim();
  if (!ref) return false;
  if (ref.length > 500) return false;
  if (ref.startsWith("drafts.")) return false;
  if (/\s/.test(ref) && !ref.includes(":")) return false;
  return true;
}

function upsertCandidate(
  map: Map<string, MenuTranslationSourceCandidate>,
  candidate: MenuTranslationSourceCandidate | null,
): void {
  if (!candidate) return;
  map.set(translationSourceCandidateKey(candidate), candidate);
}

function buildCandidate(
  providerId: string,
  sourceKind: MenuContentSourceKind,
  sourceRef: string,
  field: MenuContentField,
  originalText: string,
): MenuTranslationSourceCandidate | null {
  if (!isStableSourceRef(sourceRef)) return null;
  const text = String(originalText ?? "").trim();
  if (!text) return null;
  const pid = String(providerId ?? "").trim();
  if (!pid) return null;
  return {
    provider_id: pid,
    source_kind: sourceKind,
    source_ref: sourceRef.trim(),
    field,
    original_text: text,
    original_text_hash: hashOriginalText(text),
  };
}

/** Extract stable candidates from static lunchCategory catalog (same refs as employee overlay). */
export function extractTranslationSourcesFromCatalog(
  providerId: string,
  catalog: ProviderMenuCatalogSnapshot,
): MenuTranslationSourceCandidate[] {
  const map = new Map<string, MenuTranslationSourceCandidate>();

  for (const row of catalog.rows) {
    const category = categoryFromLunchCategoryKey(row.key);
    if (!category || category === "varmrett") continue;

    const categorySlug = sourceRefForCategoryLabel(category);
    const labelText = categoryLabelFromCatalog(catalog, category);
    upsertCandidate(
      map,
      buildCandidate(providerId, "category_label", categorySlug, "label", labelText),
    );

    for (const item of row.items ?? []) {
      const itemRef = sourceRefForMenuDayItem(item.key);
      upsertCandidate(
        map,
        buildCandidate(providerId, "menu_day_item", itemRef, "title", item.title),
      );
      if (item.description) {
        upsertCandidate(
          map,
          buildCandidate(providerId, "menu_day_item", itemRef, "description", item.description),
        );
      }
      for (const allergen of item.allergens ?? []) {
        upsertCandidate(
          map,
          buildCandidate(
            providerId,
            "allergen_label",
            normalizeAllergenSourceRef(allergen),
            "label",
            allergen,
          ),
        );
      }
    }
  }

  return [...map.values()];
}

/** Extract candidates from order-window shaped days (menu_day / varmrett runtime). */
export function extractTranslationSourcesFromOrderWindowDays(
  providerId: string,
  days: OrderWindowDayForOverlay[],
): MenuTranslationSourceCandidate[] {
  const map = new Map<string, MenuTranslationSourceCandidate>();

  for (const day of days) {
    const sources = collectTranslationSourcesFromOrderWindowDay(day);
    for (const source of sources) {
      upsertCandidate(
        map,
        buildCandidate(
          providerId,
          source.sourceKind,
          source.sourceRef,
          source.field,
          source.originalText,
        ),
      );
    }
  }

  return [...map.values()];
}

export function mergeTranslationSourceCandidates(
  ...lists: MenuTranslationSourceCandidate[][]
): MenuTranslationSourceCandidate[] {
  const map = new Map<string, MenuTranslationSourceCandidate>();
  for (const list of lists) {
    for (const candidate of list) {
      map.set(translationSourceCandidateKey(candidate), candidate);
    }
  }
  return [...map.values()];
}
