/** Stable i18n keys for /leverandor/registreringer server action failures (provider.registrations.errors.*). */

export const PROVIDER_REGISTRATION_ACTION_ERROR_KEYS = [
  "notAuthenticated",
  "providerAdminRequired",
  "registrationNotFound",
  "registrationAlreadyProcessed",
  "invalidTier",
  "rejectReasonRequired",
  "approveFailed",
  "rejectFailed",
  "actionFailed",
  "unknown",
] as const;

export type ProviderRegistrationActionErrorKey =
  (typeof PROVIDER_REGISTRATION_ACTION_ERROR_KEYS)[number];

export function isProviderRegistrationActionErrorKey(
  value: unknown,
): value is ProviderRegistrationActionErrorKey {
  return (
    typeof value === "string" &&
    (PROVIDER_REGISTRATION_ACTION_ERROR_KEYS as readonly string[]).includes(value)
  );
}

export function registrationActionFailure(errorKey: ProviderRegistrationActionErrorKey) {
  return { success: false as const, errorKey };
}

/** Resolve user-visible error text on the client from action errorKey. */
export function resolveProviderRegistrationActionError(
  t: (key: ProviderRegistrationActionErrorKey) => string,
  result: { success: false; errorKey?: unknown },
): string {
  if (isProviderRegistrationActionErrorKey(result.errorKey)) {
    return t(result.errorKey);
  }
  return t("actionFailed");
}

/** Map RPC error message to stable errorKey — never leak raw RPC text to UI. */
export function mapRegistrationRpcErrorKey(message: string): ProviderRegistrationActionErrorKey {
  const m = message.toUpperCase();
  if (m.includes("REGISTRATION_NOT_PENDING")) return "registrationAlreadyProcessed";
  if (m.includes("PERMISSION_DENIED")) return "providerAdminRequired";
  if (m.includes("AGREEMENT_TIER_INVALID")) return "invalidTier";
  if (m.includes("NOT_FOUND")) return "registrationNotFound";
  return "actionFailed";
}
