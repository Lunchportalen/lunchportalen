// lib/providers/providerMenuActionErrors.ts
// Client-safe mapping of provider menu API errors/warnings to i18n keys.

import {
  enterpriseValidationMessageKeyFromNb,
  stripPublishConfirmSuffixNb,
  type EnterpriseValidationMessageKey,
} from "@/lib/providers/providerMenuPackageSurface";

export const PROVIDER_MENU_API_ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  BAD_REQUEST: "BAD_REQUEST",
  INVALID_BODY: "INVALID_BODY",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  SANITY_WRITE_DISABLED: "SANITY_WRITE_DISABLED",
  SANITY_WRITE_FAILED: "SANITY_WRITE_FAILED",
  MENU_ORDER_LOCKED: "MENU_ORDER_LOCKED",
  /** menu-catalog route */
  SAVE_FAILED: "SAVE_FAILED",
  SANITY_WRITE_BLOCKED: "SANITY_WRITE_BLOCKED",
} as const;

export const PROVIDER_MENU_ERROR_KEYS = [
  "loadFailed",
  "saveFailed",
  "resetVarmrettFailed",
  "unauthorized",
  "forbidden",
  "badRequest",
  "invalidBody",
  "validationFailed",
  "publishUnavailable",
  "orderLocked",
  "publishConfirmGeneric",
  "publishConfirmRequired",
  "unknown",
] as const;

export type ProviderMenuErrorKey = (typeof PROVIDER_MENU_ERROR_KEYS)[number];

export type ProviderMenuApiErrorBody = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export type ProviderMenuErrorTranslator = (
  key: string,
  values?: Record<string, string>,
) => string;

export type ResolveProviderMenuApiErrorOptions = {
  /** Full i18n path when no code-specific mapping exists (e.g. catalog.messages.saveFailed). */
  fallbackMessageKey?: string;
};

const API_CODE_TO_ERROR_KEY: Record<string, ProviderMenuErrorKey> = {
  [PROVIDER_MENU_API_ERROR_CODES.UNAUTHORIZED]: "unauthorized",
  [PROVIDER_MENU_API_ERROR_CODES.FORBIDDEN]: "forbidden",
  [PROVIDER_MENU_API_ERROR_CODES.BAD_REQUEST]: "badRequest",
  [PROVIDER_MENU_API_ERROR_CODES.INVALID_BODY]: "invalidBody",
  [PROVIDER_MENU_API_ERROR_CODES.VALIDATION_ERROR]: "validationFailed",
  [PROVIDER_MENU_API_ERROR_CODES.SANITY_WRITE_DISABLED]: "publishUnavailable",
  [PROVIDER_MENU_API_ERROR_CODES.SANITY_WRITE_FAILED]: "saveFailed",
  [PROVIDER_MENU_API_ERROR_CODES.MENU_ORDER_LOCKED]: "orderLocked",
};

function isProviderMenuErrorKey(value: string): value is ProviderMenuErrorKey {
  return (PROVIDER_MENU_ERROR_KEYS as readonly string[]).includes(value);
}

export function resolveEnterpriseWarningMessageKey(rawMessage: string): EnterpriseValidationMessageKey | null {
  const { base } = stripPublishConfirmSuffixNb(rawMessage);
  return enterpriseValidationMessageKeyFromNb(base);
}

export function resolveEnterpriseWarningPresentation(
  t: ProviderMenuErrorTranslator,
  rawWarning: string,
): string | null {
  const messageKey = resolveEnterpriseWarningMessageKey(rawWarning);
  if (!messageKey) return null;
  return t(`validation.enterprise.${messageKey}`);
}

/** Maps API warning strings (nb server text) to translated publish-confirm UI. */
export function resolvePublishConfirmPresentation(
  t: ProviderMenuErrorTranslator,
  rawWarning: string,
): string {
  const translated = resolveEnterpriseWarningPresentation(t, rawWarning);
  if (translated) {
    return t("errors.publishConfirmRequired", { warning: translated });
  }
  return t("errors.publishConfirmGeneric");
}

/**
 * Maps provider menu API error bodies to translated UI copy.
 * Never surfaces raw server `message` when a safe fallback exists.
 */
export function resolveProviderMenuApiError(
  t: ProviderMenuErrorTranslator,
  body: ProviderMenuApiErrorBody,
  fallbackKey: ProviderMenuErrorKey = "saveFailed",
  options?: ResolveProviderMenuApiErrorOptions,
): string {
  const code = String(body.error ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (code === PROVIDER_MENU_API_ERROR_CODES.VALIDATION_ERROR && message) {
    const { base, hadSuffix } = stripPublishConfirmSuffixNb(message);
    const messageKey = enterpriseValidationMessageKeyFromNb(base);
    if (messageKey) {
      const warning = t(`validation.enterprise.${messageKey}`);
      if (hadSuffix) {
        return t("errors.publishConfirmRequired", { warning });
      }
      return warning;
    }
  }

  const mapped = API_CODE_TO_ERROR_KEY[code];
  if (mapped && isProviderMenuErrorKey(mapped)) {
    return t(`errors.${mapped}`);
  }

  const safeFallback = isProviderMenuErrorKey(fallbackKey) ? fallbackKey : "saveFailed";
  if (options?.fallbackMessageKey) {
    return t(options.fallbackMessageKey);
  }
  return t(`errors.${safeFallback}`);
}

/** Maps menu-catalog API errors — never surfaces raw server message in UI. */
export function resolveProviderMenuCatalogApiError(
  t: ProviderMenuErrorTranslator,
  body: ProviderMenuApiErrorBody,
): string {
  const code = String(body.error ?? "").trim();
  if (
    code === PROVIDER_MENU_API_ERROR_CODES.SAVE_FAILED ||
    code === PROVIDER_MENU_API_ERROR_CODES.SANITY_WRITE_BLOCKED
  ) {
    return t("catalog.messages.saveFailed");
  }
  const resolved = resolveProviderMenuApiError(t, body, "saveFailed", {
    fallbackMessageKey: "catalog.messages.saveFailed",
  });
  if (resolved === t("errors.validationFailed")) {
    return t("catalog.messages.saveFailed");
  }
  return resolved;
}
