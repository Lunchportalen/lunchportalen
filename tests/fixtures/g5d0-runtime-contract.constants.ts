/** G5d.0 — shared contract constants (tests only). */

export const CANONICAL_CATEGORIES = [
  "paasmurt",
  "salat",
  "sushi",
  "pokebowl",
  "thai",
  "varmrett",
] as const;

export const CANONICAL_LUNCH_CATEGORY_KEYS = [
  "paasmurt",
  "salatboks",
  "sushi",
  "pokebowl",
  "thaimat",
  "varmrett",
] as const;

export const CANONICAL_ORDER_CHOICE_KEYS = [
  "paasmurt",
  "salatboks",
  "sushi",
  "pokebowl",
  "thaimat",
  "varmmat",
] as const;

export const EDITABLE_CATALOG_KEYS = [
  "paasmurt",
  "salatboks",
  "sushi",
  "pokebowl",
  "thaimat",
] as const;

/** MenuProfile / presentation keys that must not reach runtime payloads in G5d.0. */
export const PROFILE_KEYS_MUST_NOT_LEAK = [
  "panini",
  "insalata",
  "primo_del_giorno",
  "piatto_freddo",
  "belegte_broetchen",
  "warme_mahlzeit",
  "vegetarische_option",
  "enterprise_upgrade",
] as const;

export const WARM_DISH_PREVIEW_ID_SAMPLES = [
  "warm-dish-preview:norwegian_company_lunch:kjottkaker",
  "warm-dish-preview:italian_office_lunch:primo_del_giorno",
] as const;

/** Forbidden in employee /week + order/window response contracts. */
export const EMPLOYEE_COMMERCIAL_FIELD_NAMES = [
  "price",
  "unit_price",
  "line_total",
  "cost",
  "margin",
  "commission",
  "provisjon",
  "vat_rate",
  "provider_price_rules",
  "pricePreview",
  "tripletex",
  "billingHold",
] as const;

export const PROVIDER_OWNED_TITLE_SAMPLE = "Kylling karri";
