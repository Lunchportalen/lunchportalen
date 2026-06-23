/** Stable i18n keys for Tripletex provider server actions (provider.tripletex.errors.*). */

export const PROVIDER_TRIPLETEX_ACTION_ERROR_KEYS = [
  "notAuthenticated",
  "providerAdminRequired",
  "forbidden",
  "invalidCompanyId",
  "missingToken",
  "tokenVerificationFailed",
  "verificationFailed",
  "credentialsLoadFailed",
  "configurationMissing",
  "connectionTestFailed",
  "healthLoadFailed",
  "disconnectFailed",
  "invalidState",
  "rotateFailed",
  "webhookSecretRequired",
  "webhookSyncFailed",
  "provisioningNotComplete",
  "completeFailed",
  "finalizeFailed",
  "saveFailed",
  "unknown",
] as const;

export type ProviderTripletexActionErrorKey = (typeof PROVIDER_TRIPLETEX_ACTION_ERROR_KEYS)[number];

export type TripletexActionFailure = {
  ok: false;
  errorKey: ProviderTripletexActionErrorKey;
  code?: string;
};

export function isProviderTripletexActionErrorKey(
  value: unknown,
): value is ProviderTripletexActionErrorKey {
  return (
    typeof value === "string" &&
    (PROVIDER_TRIPLETEX_ACTION_ERROR_KEYS as readonly string[]).includes(value)
  );
}

export function tripletexActionFailure(
  errorKey: ProviderTripletexActionErrorKey,
  code?: string,
): TripletexActionFailure {
  return code ? { ok: false, errorKey, code } : { ok: false, errorKey };
}

export function resolveTripletexActionError(
  t: (key: ProviderTripletexActionErrorKey) => string,
  result: { ok: false; errorKey?: unknown },
  fallback: ProviderTripletexActionErrorKey = "saveFailed",
): string {
  if (isProviderTripletexActionErrorKey(result.errorKey)) {
    return t(result.errorKey);
  }
  return t(fallback);
}

export function mapDisconnectRpcErrorKey(message: string): ProviderTripletexActionErrorKey {
  if (String(message ?? "").includes("INVALID_STATE_FOR_DISCONNECT")) return "invalidState";
  return "disconnectFailed";
}

export function mapFinalizeRpcErrorKey(message: string): ProviderTripletexActionErrorKey {
  const msg = String(message ?? "");
  if (msg.includes("PROVISIONING_NOT_COMPLETE")) return "provisioningNotComplete";
  if (msg.includes("WEBHOOK_SECRET_REQUIRED")) return "webhookSecretRequired";
  return "finalizeFailed";
}
