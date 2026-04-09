/**
 * U98 — Kanonisk Language definition (Umbraco-lignende). storageLocale mapper til content_page_variants.locale (nb | en).
 */

export type CmsStorageLocale = "nb" | "en";

export type LanguageDefinition = {
  alias: string;
  title: string;
  /** Kulturkode vist i UI (f.eks. nb-NO). */
  cultureCode: string;
  /** DB/API locale for variant-rader. */
  storageLocale: CmsStorageLocale;
  isDefault: boolean;
  isMandatory: boolean;
  enabled: boolean;
  /** Valgfri fallback-kultur (kode) når felt mangler — runtime kan bruke senere. */
  fallbackCultureCode?: string;
};

const BASELINE: readonly LanguageDefinition[] = [
  {
    alias: "nb-no",
    title: "Norsk (bokmål)",
    cultureCode: "nb-NO",
    storageLocale: "nb",
    isDefault: true,
    isMandatory: true,
    enabled: true,
  },
  {
    alias: "en-gb",
    title: "English (UK)",
    cultureCode: "en-GB",
    storageLocale: "en",
    isDefault: false,
    isMandatory: false,
    enabled: true,
    fallbackCultureCode: "nb-NO",
  },
];

const BY_ALIAS = new Map(BASELINE.map((d) => [d.alias, d]));

export function listBaselineLanguageDefinitions(): readonly LanguageDefinition[] {
  return BASELINE;
}

export function listLanguageAliases(): string[] {
  return BASELINE.map((d) => d.alias);
}

export function getBaselineLanguageDefinition(alias: string): LanguageDefinition | undefined {
  const k = String(alias ?? "").trim();
  if (!k) return undefined;
  const d = BY_ALIAS.get(k);
  return d ? structuredClone(d) : undefined;
}

export function cloneLanguageDefinition(d: LanguageDefinition): LanguageDefinition {
  return { ...d, fallbackCultureCode: d.fallbackCultureCode };
}

export function defaultStorageLocaleFromLanguages(list: readonly LanguageDefinition[]): CmsStorageLocale {
  const def = list.find((l) => l.enabled && l.isDefault);
  if (def) return def.storageLocale;
  const first = list.find((l) => l.enabled);
  return first?.storageLocale ?? "nb";
}
