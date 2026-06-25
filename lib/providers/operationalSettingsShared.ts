// lib/providers/operationalSettingsShared.ts
// Client-safe typer og validering for provider-eide driftsinnstillinger.
// Ingen Supabase/server-avhengigheter her (brukes av både UI og server action).

import { APP_LOCALES, intlLocaleForAppLocale } from "@/lib/i18n/localeRegistry";

export type ProviderOperationalSettings = {
  operationsEmail: string | null;
  kitchenEmail: string | null;
  deliveryEmail: string | null;
  locale: string;
};

/**
 * Låst forretningsregel (provider-eid e-postrouting): cateringfirmaet må selv
 * legge inn sine operative e-poster. UI-copy: provider.settings.page.operationsNote.
 * Håndheves i resolveren (Lunchportalen er aldri fallback for providerens drift).
 */
export const PROVIDER_EMAIL_OWNERSHIP_NOTE =
  "Cateringfirmaet må selv legge inn e-postadressene som skal motta ordre, kjøkkenlister og leveringsvarsler. " +
  "Lunchportalen sender ikke leverandørens operative e-poster til plattformen som standard — manglende e-post må fylles ut her.";

export type ProviderLocaleOption = { value: string; label: string };

/** Operational intl locale tags in the same order as {@link APP_LOCALES}. */
export const PROVIDER_INTL_LOCALES = APP_LOCALES.map((locale) => intlLocaleForAppLocale(locale));

const PROVIDER_LOCALE_LABELS: Record<string, string> = {
  "nb-NO": "Norsk (bokmål)",
  "da-DK": "Dansk",
  "de-DE": "Deutsch",
  "en-GB": "English",
  "es-ES": "Español",
  "fr-FR": "Français",
  "it-IT": "Italiano",
  "fi-FI": "Suomi",
  "sv-SE": "Svenska",
};

/**
 * Kontrollert allowlist. provider_settings.locale er foreløpig inert i runtime,
 * men verdien valideres slik at fremtidig språkstøtte kan stole på den.
 * Rekkefølge følger {@link APP_LOCALES} (Norsk først, deretter alfabetisk etter visningsnavn).
 */
export const PROVIDER_LOCALE_OPTIONS: ProviderLocaleOption[] = PROVIDER_INTL_LOCALES.map((value) => ({
  value,
  label: PROVIDER_LOCALE_LABELS[value] ?? value,
}));

export const PROVIDER_LOCALE_VALUES = PROVIDER_LOCALE_OPTIONS.map((o) => o.value);

export const DEFAULT_PROVIDER_LOCALE = "nb-NO";

export function isSupportedProviderLocale(value: unknown): value is string {
  return PROVIDER_LOCALE_OPTIONS.some((o) => o.value === value);
}

const EMAIL_RE = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const MAX_EMAIL_LENGTH = 254;

export type NormalizedEmailResult = { ok: true; value: string | null } | { ok: false; error: string };

/**
 * Normaliserer en valgfri e-post: trim + lowercase.
 * Tomt felt er gyldig og betyr null (= bruk fallback-kjeden).
 */
export function normalizeOperationalEmail(input: unknown): NormalizedEmailResult {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return { ok: true, value: null };
  if (raw.length > MAX_EMAIL_LENGTH) {
    return { ok: false, error: "E-postadressen er for lang." };
  }
  if (!EMAIL_RE.test(raw)) {
    return { ok: false, error: "Ugyldig e-postadresse." };
  }
  return { ok: true, value: raw };
}
