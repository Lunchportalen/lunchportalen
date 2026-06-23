/** Stable i18n keys for /leverandor/faktura billing contact action (provider.billing.errors.*). */

export const PROVIDER_BILLING_ACTION_ERROR_KEYS = [
  "notAuthenticated",
  "providerAdminRequired",
  "forbidden",
  "invalidEmail",
  "activeSubscriptionNotFound",
  "saveFailed",
  "unknown",
] as const;

export type ProviderBillingActionErrorKey = (typeof PROVIDER_BILLING_ACTION_ERROR_KEYS)[number];

export function isProviderBillingActionErrorKey(value: unknown): value is ProviderBillingActionErrorKey {
  return (
    typeof value === "string" &&
    (PROVIDER_BILLING_ACTION_ERROR_KEYS as readonly string[]).includes(value)
  );
}

export function billingContactActionFailure(errorKey: ProviderBillingActionErrorKey) {
  return { success: false as const, errorKey };
}

/** Map RPC error message to stable key — never leak raw server message to UI. */
export function mapBillingContactRpcErrorKey(message: string): ProviderBillingActionErrorKey {
  const m = String(message ?? "");
  if (m.includes("PERMISSION_DENIED")) return "forbidden";
  if (m.includes("INVALID_BILLING_EMAIL")) return "invalidEmail";
  if (m.includes("ACTIVE_SUBSCRIPTION_NOT_FOUND")) return "activeSubscriptionNotFound";
  return "saveFailed";
}

export function resolveProviderBillingActionError(
  t: (key: ProviderBillingActionErrorKey) => string,
  result: { success: false; errorKey?: unknown },
  fallback: ProviderBillingActionErrorKey = "saveFailed",
): string {
  if (isProviderBillingActionErrorKey(result.errorKey)) {
    return t(result.errorKey);
  }
  return t(fallback);
}
