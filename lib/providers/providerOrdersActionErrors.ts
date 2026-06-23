/** Stable i18n keys for /leverandor/ordrer server action failures (provider.orders.errors.*). */

export const PROVIDER_ORDERS_ACTION_ERROR_KEYS = [
  "notAuthenticated",
  "orderNotFound",
  "kitchenRoleRequired",
  "updateFailed",
  "unknown",
] as const;

export type ProviderOrdersActionErrorKey = (typeof PROVIDER_ORDERS_ACTION_ERROR_KEYS)[number];

export function isProviderOrdersActionErrorKey(value: unknown): value is ProviderOrdersActionErrorKey {
  return (
    typeof value === "string" &&
    (PROVIDER_ORDERS_ACTION_ERROR_KEYS as readonly string[]).includes(value)
  );
}

export function kitchenOrderActionFailure(errorKey: ProviderOrdersActionErrorKey) {
  return { success: false as const, errorKey };
}

/** Resolve user-visible error text on the client from action errorKey. */
export function resolveProviderOrdersActionError(
  t: (key: ProviderOrdersActionErrorKey) => string,
  result: { success: false; errorKey?: unknown },
): string {
  if (isProviderOrdersActionErrorKey(result.errorKey)) {
    return t(result.errorKey);
  }
  return t("updateFailed");
}
