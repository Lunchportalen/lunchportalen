/** Stable i18n keys for /leverandor/kunder server action + customer detail API failures (provider.customers.errors.*). */

export const PROVIDER_CUSTOMER_ACTION_ERROR_KEYS = [
  "notAuthenticated",
  "providerAdminRequired",
  "providerContextMissing",
  "customerNotFound",
  "invalidCustomer",
  "reasonTooShort",
  "forbidden",
  "outOfScope",
  "confirmMismatch",
  "hardDeleteBlocked",
  "alreadyArchived",
  "alreadyActive",
  "protectedSystem",
  "selfCustomer",
  "validationFailed",
  "invalidAgreement",
  "invalidPayload",
  "noActiveAgreement",
  "updateFailed",
  "suspendFailed",
  "pauseFailed",
  "removeFailed",
  "restoreFailed",
  "loadRulesFailed",
  "agreementLoadFailed",
  "agreementUpdateFailed",
  "unknown",
] as const;

export type ProviderCustomerActionErrorKey = (typeof PROVIDER_CUSTOMER_ACTION_ERROR_KEYS)[number];

export type ProviderCustomerApiErrorContext =
  | "removalLoad"
  | "removalAction"
  | "restoreAction"
  | "agreementLoad"
  | "agreementSave";

export type ProviderCustomerApiErrBody = {
  ok?: false;
  message?: string;
  error?: unknown;
  rid?: string;
  detail?: { code?: unknown; blockers?: string[] };
};

export function isProviderCustomerActionErrorKey(value: unknown): value is ProviderCustomerActionErrorKey {
  return (
    typeof value === "string" &&
    (PROVIDER_CUSTOMER_ACTION_ERROR_KEYS as readonly string[]).includes(value)
  );
}

export function customerActionFailure(errorKey: ProviderCustomerActionErrorKey) {
  return { success: false as const, errorKey };
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export function extractProviderCustomerApiErrorCode(body: ProviderCustomerApiErrBody | null): string {
  const fromDetail = safeStr(body?.detail?.code);
  if (fromDetail) return fromDetail.toUpperCase();
  return safeStr(body?.error).toUpperCase();
}

export function defaultProviderCustomerApiErrorKey(
  context: ProviderCustomerApiErrorContext,
): ProviderCustomerActionErrorKey {
  switch (context) {
    case "removalLoad":
      return "loadRulesFailed";
    case "removalAction":
      return "removeFailed";
    case "restoreAction":
      return "restoreFailed";
    case "agreementLoad":
      return "agreementLoadFailed";
    case "agreementSave":
      return "agreementUpdateFailed";
  }
}

const AGREEMENT_VALIDATION_CODES = new Set([
  "INVALID_DELIVERY_DAYS",
  "EMPTY_DELIVERY_DAYS",
  "INVALID_DELIVERY_DAY",
  "DUPLICATE_DELIVERY_DAY",
  "WEEKEND_NOT_SUPPORTED",
  "INVALID_DAY_MENUS",
  "INVALID_DAY_MENU",
  "MISSING_DAY_MENU",
  "INACTIVE_DAY_MENU",
  "INVALID_PLAN",
  "DUPLICATE_DAY_MENU",
  "INVALID_BILLING",
  "INVALID_INVOICE_METHOD",
  "INVALID_INVOICE_EMAIL",
  "MISSING_EHF_ENDPOINT",
  "INVALID_ORGNR",
  "INVALID_BILLING_CONTACT",
  "INVALID_BILLING_CONTACT_EMAIL",
  "INVALID_BILLING_CONTACT_PHONE",
  "INVALID_LOCATION",
  "INVALID_CONTACT",
  "INVALID_CONTACT_EMAIL",
  "INVALID_CONTACT_PHONE",
  "INVALID_DELIVERY_WINDOW",
  "INVALID_STATUS",
  "NO_ACTIVE_AGREEMENT",
]);

/** Map provider customer API `error` / `detail.code` to stable i18n key — never leak raw server message. */
export function mapProviderCustomerApiErrorKey(
  code: string,
  context: ProviderCustomerApiErrorContext,
): ProviderCustomerActionErrorKey {
  const c = safeStr(code).toUpperCase();
  if (!c) return defaultProviderCustomerApiErrorKey(context);

  if (c === "UNAUTHORIZED") return "notAuthenticated";
  if (c === "PROVIDER_CONTEXT_MISSING") return "providerContextMissing";
  if (c === "PROVIDER_ROLE_MISSING") return "providerAdminRequired";
  if (c === "NOT_FOUND") return "customerNotFound";
  if (c === "OUT_OF_SCOPE") return "outOfScope";
  if (c === "FORBIDDEN") return "forbidden";
  if (c === "VALIDATION") return "validationFailed";
  if (c === "BAD_REQUEST") return "invalidCustomer";
  if (c === "CONFIRM_MISMATCH") return "confirmMismatch";
  if (c === "HARD_DELETE_BLOCKED") return "hardDeleteBlocked";
  if (c === "ALREADY_ARCHIVED") return "alreadyArchived";
  if (c === "PROTECTED_SYSTEM") return "protectedSystem";
  if (c === "SELF_CUSTOMER") return "selfCustomer";
  if (c === "NO_ACTIVE_AGREEMENT") return "noActiveAgreement";
  if (c === "NOT_DELETED" || c === "ALREADY_ACTIVE") return "alreadyActive";
  if (c === "EXECUTION_FAILED" || c === "DB_ERROR") return defaultProviderCustomerApiErrorKey(context);
  if (c === "EMPTY_PATCH") return "invalidPayload";
  if (AGREEMENT_VALIDATION_CODES.has(c)) return "invalidAgreement";

  return defaultProviderCustomerApiErrorKey(context);
}

function appendRid(text: string, rid: string) {
  return rid ? `${text} (RID: ${rid})` : text;
}

/** Resolve user-visible API error text on the client from API error code + context. */
export function resolveProviderCustomerApiError(
  t: (key: ProviderCustomerActionErrorKey) => string,
  body: ProviderCustomerApiErrBody | null,
  context: ProviderCustomerApiErrorContext,
  httpStatus?: number,
): string {
  const code = extractProviderCustomerApiErrorCode(body);
  const key = mapProviderCustomerApiErrorKey(code, context);
  const rid = safeStr(body?.rid);
  if (!code && httpStatus && httpStatus >= 500) {
    return appendRid(t(defaultProviderCustomerApiErrorKey(context)), rid);
  }
  return appendRid(t(key), rid);
}

/** Resolve user-visible error text on the client from server action errorKey. */
export function resolveProviderCustomerActionError(
  t: (key: ProviderCustomerActionErrorKey) => string,
  result: { success: false; errorKey?: unknown },
): string {
  if (isProviderCustomerActionErrorKey(result.errorKey)) {
    return t(result.errorKey);
  }
  return t("updateFailed");
}
