export type TierCode = "BASIS" | "LUXUS" | "ENTERPRISE";

export type TierDisplayFallbackMode = "blank" | "dash" | "raw";

type SupportedTierLocale =
  | "nb-NO"
  | "sv-SE"
  | "da-DK"
  | "fi-FI"
  | "en-GB"
  | "de-DE"
  | "fr-FR"
  | "es-ES"
  | "it-IT"
  | "en-US"
  | "en-CA"
  | "nl-NL"
  | "nl-BE"
  | "fr-BE"
  | "de-AT"
  | "de-CH"
  | "fr-CH"
  | "en-IE"
  | "fr-LU"
  | "en-AU"
  | "en-SG";

const DEFAULT_LOCALE: SupportedTierLocale = "en-GB";

const TIER_CODES = ["BASIS", "LUXUS", "ENTERPRISE"] as const;

const TIER_DISPLAY_LABELS: Record<SupportedTierLocale, Record<TierCode, string>> = {
  "nb-NO": {
    BASIS: "Basis",
    LUXUS: "Luksus",
    ENTERPRISE: "Enterprise",
  },
  "sv-SE": {
    BASIS: "Bas",
    LUXUS: "Lyx",
    ENTERPRISE: "Enterprise",
  },
  "da-DK": {
    BASIS: "Basis",
    LUXUS: "Luksus",
    ENTERPRISE: "Enterprise",
  },
  "fi-FI": {
    BASIS: "Perus",
    LUXUS: "Luksus",
    ENTERPRISE: "Enterprise",
  },
  "en-GB": {
    BASIS: "Basic",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "de-DE": {
    BASIS: "Basis",
    LUXUS: "Luxus",
    ENTERPRISE: "Enterprise",
  },
  "fr-FR": {
    BASIS: "Essentiel",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "es-ES": {
    BASIS: "Básico",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "it-IT": {
    BASIS: "Base",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "en-US": {
    BASIS: "Basic",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "en-CA": {
    BASIS: "Basic",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "nl-NL": {
    BASIS: "Basis",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "nl-BE": {
    BASIS: "Basis",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "fr-BE": {
    BASIS: "Essentiel",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "de-AT": {
    BASIS: "Basis",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "de-CH": {
    BASIS: "Basis",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "fr-CH": {
    BASIS: "Essentiel",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "en-IE": {
    BASIS: "Basic",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "fr-LU": {
    BASIS: "Essentiel",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "en-AU": {
    BASIS: "Basic",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
  "en-SG": {
    BASIS: "Basic",
    LUXUS: "Premium",
    ENTERPRISE: "Enterprise",
  },
};

const LOCALE_ALIASES: Record<string, SupportedTierLocale> = {
  nb: "nb-NO",
  "nb-no": "nb-NO",
  no: "nb-NO",
  sv: "sv-SE",
  "sv-se": "sv-SE",
  da: "da-DK",
  "da-dk": "da-DK",
  fi: "fi-FI",
  "fi-fi": "fi-FI",
  en: "en-GB",
  "en-gb": "en-GB",
  de: "de-DE",
  "de-de": "de-DE",
  fr: "fr-FR",
  "fr-fr": "fr-FR",
  es: "es-ES",
  "es-es": "es-ES",
  it: "it-IT",
  "it-it": "it-IT",
  "en-us": "en-US",
  "en-ca": "en-CA",
  nl: "nl-NL",
  "nl-nl": "nl-NL",
  "nl-be": "nl-BE",
  "fr-be": "fr-BE",
  "de-at": "de-AT",
  "de-ch": "de-CH",
  "fr-ch": "fr-CH",
  "en-ie": "en-IE",
  "fr-lu": "fr-LU",
  "en-au": "en-AU",
  "en-sg": "en-SG",
};

function normalizeLocale(locale: unknown): SupportedTierLocale {
  const value = String(locale ?? "").trim();
  const lower = value.toLowerCase();
  if (LOCALE_ALIASES[lower]) return LOCALE_ALIASES[lower];
  return Object.prototype.hasOwnProperty.call(TIER_DISPLAY_LABELS, value)
    ? (value as SupportedTierLocale)
    : DEFAULT_LOCALE;
}

export function isTierCode(value: unknown): value is TierCode {
  const normalized = String(value ?? "").trim().toUpperCase();
  return TIER_CODES.includes(normalized as TierCode);
}

export function getTierDisplayLabel(tierCode: TierCode, locale: unknown): string {
  return TIER_DISPLAY_LABELS[normalizeLocale(locale)][tierCode];
}

export function getTierDisplayWithCode(tierCode: TierCode, locale: unknown): string {
  return `${getTierDisplayLabel(tierCode, locale)} (${tierCode})`;
}

export function getTierDisplayLabelSafe(
  value: unknown,
  locale: unknown,
  options: {
    fallbackMode?: TierDisplayFallbackMode;
    debugWithCode?: boolean;
  } = {},
): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (isTierCode(normalized)) {
    return options.debugWithCode
      ? getTierDisplayWithCode(normalized, locale)
      : getTierDisplayLabel(normalized, locale);
  }

  if (options.fallbackMode === "raw") return String(value ?? "").trim();
  if (options.fallbackMode === "blank") return "";
  return "—";
}
