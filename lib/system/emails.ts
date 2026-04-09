// lib/system/emails.ts

export * from "./emailAddresses";

import {
  DRIVER_ALIAS_EMAIL,
  DRIVER_EMAIL,
  KITCHEN_EMAIL,
  ORDER_EMAIL,
  REMOTE_BACKEND_HARNESS_EMAIL,
  SUPERADMIN_EMAIL,
  SUPPORT_EMAIL,
} from "./emailAddresses";

/** Standard avsender for Resend når RESEND_FROM ikke er satt. */
export const RESEND_DEFAULT_FROM = "Lunchportalen <noreply@lunchportalen.no>";

/** Legacy fallback «from» for Resend når `LP_RESEND_FROM` mangler (ordre-kanal). */
export const RESEND_DEFAULT_FROM_ORDER = `Lunchportalen <${ORDER_EMAIL}>`;

export const SYSTEM_EMAILS = {
  SUPERADMIN: SUPERADMIN_EMAIL,
  KITCHEN: KITCHEN_EMAIL,
  DRIVER: DRIVER_EMAIL,
  DRIVER_ALIAS: DRIVER_ALIAS_EMAIL,
  ORDER: ORDER_EMAIL,
  SUPPORT: SUPPORT_EMAIL,
} as const;

export const SYSTEM_EMAIL_ALLOWLIST = (() => {
  const raw = process.env.SYSTEM_EMAIL_ALLOWLIST;
  const list = (raw
    ? raw.split(",")
    : [SYSTEM_EMAILS.ORDER, "noreply@lunchportalen.no"]
  )
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean);
  const unique = Array.from(new Set(list));
  if (unique.length === 0) {
    throw new Error("SYSTEM_EMAIL_ALLOWLIST is missing or empty.");
  }
  return unique;
})();

export type SystemRole = "superadmin" | "kitchen" | "driver";

function remoteBackendHarnessSuperadminEnabled(): boolean {
  const enabled = String(process.env.LP_REMOTE_BACKEND_AUTH_HARNESS ?? "").trim().toLowerCase();
  const runtimeMode = String(process.env.LP_CMS_RUNTIME_MODE ?? "").trim().toLowerCase();
  return (enabled === "1" || enabled === "true" || enabled === "on" || enabled === "yes") && runtimeMode === "remote_backend";
}

export function normEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function systemRoleByEmail(email: unknown): SystemRole | null {
  const e = normEmail(email);
  if (e === SYSTEM_EMAILS.SUPERADMIN) return "superadmin";
  if (remoteBackendHarnessSuperadminEnabled() && e === REMOTE_BACKEND_HARNESS_EMAIL) return "superadmin";
  if (e === SYSTEM_EMAILS.KITCHEN) return "kitchen";
  if (e === SYSTEM_EMAILS.DRIVER || e === SYSTEM_EMAILS.DRIVER_ALIAS) return "driver";
  return null;
}

export function isSuperadminEmail(email: unknown): boolean {
  return normEmail(email) === SYSTEM_EMAILS.SUPERADMIN;
}

export function isSystemEmail(email: unknown): boolean {
  const e = normEmail(email);
  return (
    e === SYSTEM_EMAILS.SUPERADMIN ||
    (remoteBackendHarnessSuperadminEnabled() && e === REMOTE_BACKEND_HARNESS_EMAIL) ||
    e === SYSTEM_EMAILS.KITCHEN ||
    e === SYSTEM_EMAILS.DRIVER ||
    e === SYSTEM_EMAILS.DRIVER_ALIAS ||
    e === SYSTEM_EMAILS.ORDER ||
    e === SYSTEM_EMAILS.SUPPORT
  );
}
