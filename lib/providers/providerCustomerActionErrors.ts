/** Stable i18n keys for /leverandor/kunder server action failures (provider.customers.errors.*). */

export const PROVIDER_CUSTOMER_ACTION_ERROR_KEYS = [
  "notAuthenticated",
  "providerAdminRequired",
  "customerNotFound",
  "invalidCustomer",
  "reasonTooShort",
  "updateFailed",
  "removeFailed",
  "restoreFailed",
  "unknown",
] as const;

export type ProviderCustomerActionErrorKey = (typeof PROVIDER_CUSTOMER_ACTION_ERROR_KEYS)[number];

export function isProviderCustomerActionErrorKey(value: unknown): value is ProviderCustomerActionErrorKey {
  return (
    typeof value === "string" &&
    (PROVIDER_CUSTOMER_ACTION_ERROR_KEYS as readonly string[]).includes(value)
  );
}

export function customerActionFailure(errorKey: ProviderCustomerActionErrorKey) {
  return { success: false as const, errorKey };
}

/** Resolve user-visible error text on the client from action errorKey. */
export function resolveProviderCustomerActionError(
  t: (key: ProviderCustomerActionErrorKey) => string,
  result: { success: false; errorKey?: unknown },
): string {
  if (isProviderCustomerActionErrorKey(result.errorKey)) {
    return t(result.errorKey);
  }
  return t("updateFailed");
}
