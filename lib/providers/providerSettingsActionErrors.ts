/** Stable i18n keys for provider settings/logo/brand/operations server actions. */

export const PROVIDER_SETTINGS_PROFILE_ERROR_KEYS = [
  "notAuthenticated",
  "providerNotFound",
  "forbidden",
  "nameRequired",
  "emailRequired",
  "saveFailed",
  "unknown",
] as const;

export type ProviderSettingsProfileErrorKey = (typeof PROVIDER_SETTINGS_PROFILE_ERROR_KEYS)[number];

export const PROVIDER_SETTINGS_OPERATIONS_ERROR_KEYS = [
  "notAuthenticated",
  "providerNotFound",
  "forbidden",
  "invalidEmail",
  "emailTooLong",
  "invalidLocale",
  "saveFailed",
  "unknown",
] as const;

export type ProviderSettingsOperationsErrorKey = (typeof PROVIDER_SETTINGS_OPERATIONS_ERROR_KEYS)[number];

export const PROVIDER_SETTINGS_LOGO_ERROR_KEYS = [
  "notAuthenticated",
  "invalidProvider",
  "forbidden",
  "noFileSelected",
  "unsupportedFileType",
  "fileTooLarge",
  "uploadUnavailable",
  "uploadFailed",
  "removeFailed",
  "saveFailed",
  "urlFailed",
  "unknown",
] as const;

export type ProviderSettingsLogoErrorKey = (typeof PROVIDER_SETTINGS_LOGO_ERROR_KEYS)[number];

export const PROVIDER_SETTINGS_BRAND_ERROR_KEYS = [
  "notAuthenticated",
  "invalidProvider",
  "forbidden",
  "invalidHex",
  "contrastTooWeak",
  "saveFailed",
  "unknown",
] as const;

export type ProviderSettingsBrandErrorKey = (typeof PROVIDER_SETTINGS_BRAND_ERROR_KEYS)[number];

function isKey<T extends string>(keys: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (keys as readonly string[]).includes(value);
}

export function settingsProfileFailure(errorKey: ProviderSettingsProfileErrorKey) {
  return { ok: false as const, errorKey };
}

export function settingsOperationsFailure(errorKey: ProviderSettingsOperationsErrorKey) {
  return { ok: false as const, errorKey };
}

export function settingsLogoFailure(errorKey: ProviderSettingsLogoErrorKey) {
  return { ok: false as const, errorKey };
}

export function settingsBrandFailure(errorKey: ProviderSettingsBrandErrorKey) {
  return { ok: false as const, errorKey };
}

export function mapOperationalEmailErrorKey(message: string): ProviderSettingsOperationsErrorKey {
  const m = String(message ?? "").trim();
  if (m === "E-postadressen er for lang.") return "emailTooLong";
  if (m === "Ugyldig e-postadresse.") return "invalidEmail";
  return "invalidEmail";
}

export function resolveProviderSettingsProfileError(
  t: (key: ProviderSettingsProfileErrorKey) => string,
  result: { ok: false; errorKey?: unknown },
): string {
  if (isKey(PROVIDER_SETTINGS_PROFILE_ERROR_KEYS, result.errorKey)) {
    return t(result.errorKey);
  }
  return t("saveFailed");
}

export function resolveProviderSettingsOperationsError(
  t: (key: ProviderSettingsOperationsErrorKey) => string,
  result: { ok: false; errorKey?: unknown },
): string {
  if (isKey(PROVIDER_SETTINGS_OPERATIONS_ERROR_KEYS, result.errorKey)) {
    return t(result.errorKey);
  }
  return t("saveFailed");
}

export function resolveProviderSettingsLogoError(
  t: (key: ProviderSettingsLogoErrorKey) => string,
  result: { ok: false; errorKey?: unknown },
  fallback: ProviderSettingsLogoErrorKey = "uploadFailed",
): string {
  if (isKey(PROVIDER_SETTINGS_LOGO_ERROR_KEYS, result.errorKey)) {
    return t(result.errorKey);
  }
  return t(fallback);
}

export function resolveProviderSettingsBrandError(
  t: (key: ProviderSettingsBrandErrorKey) => string,
  result: { ok: false; errorKey?: unknown },
): string {
  if (isKey(PROVIDER_SETTINGS_BRAND_ERROR_KEYS, result.errorKey)) {
    return t(result.errorKey);
  }
  return t("saveFailed");
}
