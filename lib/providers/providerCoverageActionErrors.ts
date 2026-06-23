/** Stable i18n keys for /leverandor/omrader server actions (provider.coverage.errors.*). */

import type { ZodIssue } from "zod";

export const PROVIDER_COVERAGE_ACTION_ERROR_KEYS = [
  "notAuthenticated",
  "providerAdminRequired",
  "forbidden",
  "validationFailed",
  "cityRequired",
  "invalidPostalFrom",
  "invalidPostalTo",
  "invalidPostalRange",
  "deliveryDaysRequired",
  "invalidEmployeeRange",
  "invalidPostalCode",
  "postalRangeInvalid",
  "employeeRangeInvalid",
  "postalOverlap",
  "serviceAreaNotFound",
  "saveFailed",
  "toggleFailed",
  "unknown",
] as const;

export type ProviderCoverageActionErrorKey = (typeof PROVIDER_COVERAGE_ACTION_ERROR_KEYS)[number];

export function isProviderCoverageActionErrorKey(value: unknown): value is ProviderCoverageActionErrorKey {
  return (
    typeof value === "string" &&
    (PROVIDER_COVERAGE_ACTION_ERROR_KEYS as readonly string[]).includes(value)
  );
}

export function coverageActionFailure(errorKey: ProviderCoverageActionErrorKey) {
  return { success: false as const, errorKey };
}

export function mapServiceAreaZodErrorKey(issue: ZodIssue | undefined): ProviderCoverageActionErrorKey {
  const path = String(issue?.path?.[0] ?? "");
  if (path === "city") return "cityRequired";
  if (path === "postal_code_from") return "invalidPostalFrom";
  if (path === "postal_code_to") {
    if (issue?.code === "custom") return "invalidPostalRange";
    return "invalidPostalTo";
  }
  if (path === "available_days") return "deliveryDaysRequired";
  if (path === "max_employees") return "invalidEmployeeRange";
  return "validationFailed";
}

/** Map RPC error message to stable key — never leak raw server message to UI. */
export function mapServiceAreaRpcErrorKey(message: string): ProviderCoverageActionErrorKey {
  const m = String(message ?? "");
  if (m.includes("PERMISSION_DENIED")) return "forbidden";
  if (m.includes("POSTAL_CODE_FORMAT_INVALID")) return "invalidPostalCode";
  if (m.includes("POSTAL_RANGE_INVALID")) return "postalRangeInvalid";
  if (m.includes("EMPLOYEE_RANGE_INVALID")) return "employeeRangeInvalid";
  if (m.includes("POSTAL_RANGE_OVERLAPS_EXISTING")) return "postalOverlap";
  if (m.includes("SERVICE_AREA_NOT_FOUND")) return "serviceAreaNotFound";
  return "saveFailed";
}

export function resolveProviderCoverageActionError(
  t: (key: ProviderCoverageActionErrorKey) => string,
  result: { success: false; errorKey?: unknown },
  fallback: ProviderCoverageActionErrorKey = "saveFailed",
): string {
  if (isProviderCoverageActionErrorKey(result.errorKey)) {
    return t(result.errorKey);
  }
  return t(fallback);
}