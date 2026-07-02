import { ALLERGEN_DISPLAY_LABELS } from "@/lib/cms/menuDayContract";
import { deepMergeMessages } from "@/lib/i18n/messages";
import {
  DEFAULT_APP_LOCALE,
  type AppLocale,
  parseAppLocale,
} from "@/lib/i18n/middlewareLocale";

import nbMessages from "../../messages/nb.json";
import enMessages from "../../messages/en.json";
import svMessages from "../../messages/sv.json";
import daMessages from "../../messages/da.json";

type MessageTree = Record<string, unknown>;

export type EmployeeWeekCategoryInput = {
  category: string | null;
  key: string;
  apiLabel: string;
};

export type OrderStatusDisplayKey =
  | "ordered"
  | "not_ordered"
  | "cancelled"
  | "cutoff_passed"
  | "unavailable";

/** Alias slugs → canonical dictionary key (identity keys unchanged). */
const ALLERGEN_SLUG_ALIASES: Record<string, string> = {
  gluten: "hvete",
  hvete: "hvete",
  skalldyr: "krepsdyr",
  krepsdyr: "krepsdyr",
  blotdyr: "blotdyr",
  bløtdyr: "blotdyr",
  nøtter: "notter",
  notter: "notter",
  peanøtter: "peanotter",
  peanotter: "peanotter",
  sulfitt: "sulfitter",
  sulfitter: "sulfitter",
  sesam: "sesam",
  sesamfrø: "sesam",
};

const CATEGORY_KEY_ALIASES: Record<string, string> = {
  paasmurt: "paasmurt",
  påsmurt: "paasmurt",
  salat: "salat",
  salatboks: "salat",
  sushi: "sushi",
  pokebowl: "pokebowl",
  "poké bowl": "pokebowl",
  poke: "pokebowl",
  thai: "thai",
  thaimat: "thai",
  varmrett: "varmrett",
  varmmat: "varmrett",
};

const NB_STATUS_FALLBACK: Record<OrderStatusDisplayKey, string> = {
  ordered: "Bestilt",
  not_ordered: "Ikke bestilt",
  cancelled: "Avbestilt",
  cutoff_passed: "Frist passert",
  unavailable: "Ikke tilgjengelig",
};

type EmployeeWeekViewMessages = {
  categories?: Record<string, string>;
  allergens?: Record<string, string>;
  status?: Record<string, string>;
  actions?: Record<string, string>;
  errors?: Record<string, string>;
  [key: string]: unknown;
};

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a");
}

function resolveCategoryDictionaryKey(input: EmployeeWeekCategoryInput): string {
  const category = normalizeToken(String(input.category ?? ""));
  if (category && CATEGORY_KEY_ALIASES[category]) return CATEGORY_KEY_ALIASES[category]!;

  const key = normalizeToken(input.key);
  if (key && CATEGORY_KEY_ALIASES[key]) return CATEGORY_KEY_ALIASES[key]!;

  const api = normalizeToken(input.apiLabel);
  if (api && CATEGORY_KEY_ALIASES[api]) return CATEGORY_KEY_ALIASES[api]!;

  return key || category || api;
}

function resolveAllergenDictionaryKey(slug: string): string {
  const normalized = normalizeToken(slug);
  if (!normalized) return slug;
  return ALLERGEN_SLUG_ALIASES[normalized] ?? normalized;
}

function lookupDictionary(
  dict: Record<string, string> | undefined,
  key: string,
): string | null {
  if (!dict) return null;
  const direct = dict[key];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return null;
}

function employeeWeekViewForLocale(locale: AppLocale): EmployeeWeekViewMessages {
  const nb = (nbMessages as MessageTree).employeeWeekView as EmployeeWeekViewMessages;
  if (locale === "nb") return nb ?? {};

  const overrides: Record<Exclude<AppLocale, "nb">, MessageTree> = {
    en: enMessages as MessageTree,
    sv: svMessages as MessageTree,
    da: daMessages as MessageTree,
    fi: {},
    de: {},
    fr: {},
    es: {},
    it: {},
  };

  const merged = deepMergeMessages(
    { employeeWeekView: nb ?? {} },
    { employeeWeekView: (overrides[locale]?.employeeWeekView as EmployeeWeekViewMessages) ?? {} },
  );

  return (merged.employeeWeekView as EmployeeWeekViewMessages) ?? {};
}

export type EmployeeWeekDisplayLabels = {
  locale: AppLocale;
  categoryLabel(input: EmployeeWeekCategoryInput): string;
  allergenLabel(slug: string): string;
  allergensListText(slugs: readonly string[]): string;
  status(key: OrderStatusDisplayKey): string;
  ui(key: string, params?: Record<string, string>): string;
};

export function createEmployeeWeekDisplayLabels(localeInput?: AppLocale | null): EmployeeWeekDisplayLabels {
  const locale = parseAppLocale(localeInput) ?? DEFAULT_APP_LOCALE;
  const view = employeeWeekViewForLocale(locale);
  const nbView = employeeWeekViewForLocale("nb");
  const categories = view.categories ?? {};
  const nbCategories = nbView.categories ?? {};
  const allergens = view.allergens ?? {};
  const nbAllergens = nbView.allergens ?? {};
  const statusMessages = view.status ?? {};
  const nbStatusMessages = nbView.status ?? {};

  function categoryLabel(input: EmployeeWeekCategoryInput): string {
    const dictKey = resolveCategoryDictionaryKey(input);
    return (
      lookupDictionary(categories, dictKey) ??
      lookupDictionary(nbCategories, dictKey) ??
      (input.apiLabel.trim() || input.key.trim() || dictKey)
    );
  }

  function allergenLabel(slug: string): string {
    const raw = String(slug ?? "").trim();
    if (!raw) return raw;
    const dictKey = resolveAllergenDictionaryKey(raw);
    return (
      lookupDictionary(allergens, dictKey) ??
      lookupDictionary(allergens, normalizeToken(raw)) ??
      lookupDictionary(nbAllergens, dictKey) ??
      lookupDictionary(nbAllergens, normalizeToken(raw)) ??
      ALLERGEN_DISPLAY_LABELS[raw] ??
      ALLERGEN_DISPLAY_LABELS[dictKey] ??
      raw
    );
  }

  function allergensListText(slugs: readonly string[]): string {
    if (!Array.isArray(slugs) || slugs.length === 0) return "";
    return slugs.map((slug) => allergenLabel(slug)).join(", ");
  }

  function status(key: OrderStatusDisplayKey): string {
    const mappedKey =
      key === "not_ordered"
        ? "notOrdered"
        : key === "cutoff_passed"
          ? "cutoffPassed"
          : key;
    return (
      lookupDictionary(statusMessages, mappedKey) ??
      lookupDictionary(nbStatusMessages, mappedKey) ??
      NB_STATUS_FALLBACK[key]
    );
  }

  function ui(key: string, params?: Record<string, string>): string {
    const parts = key.split(".");
    let cur: unknown = view;
    for (const part of parts) {
      if (!cur || typeof cur !== "object") {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    let text =
      typeof cur === "string" && cur.trim()
        ? cur.trim()
        : (() => {
            let nbCur: unknown = nbView;
            for (const part of parts) {
              if (!nbCur || typeof nbCur !== "object") {
                nbCur = undefined;
                break;
              }
              nbCur = (nbCur as Record<string, unknown>)[part];
            }
            return typeof nbCur === "string" ? nbCur.trim() : key;
          })();
    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        text = text.replaceAll(`{${paramKey}}`, paramValue);
      }
    }
    return text;
  }

  return {
    locale,
    categoryLabel,
    allergenLabel,
    allergensListText,
    status,
    ui,
  };
}

export function resolveEmployeeWeekDisplayLocale(
  serverLocale?: AppLocale | null,
  cookieValue?: string | null,
): AppLocale {
  return parseAppLocale(serverLocale) ?? parseAppLocale(cookieValue) ?? DEFAULT_APP_LOCALE;
}
