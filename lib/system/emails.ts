// lib/system/emails.ts

export const SUPERADMIN_EMAIL = "superadmin@lunchportalen.no";
export const KITCHEN_EMAIL = "kjokken@lunchportalen.no";
export const DRIVER_EMAIL = "driver@lunchportalen.no";
export const DRIVER_ALIAS_EMAIL = "sjafor@lunchportalen.no";
export const ORDER_EMAIL = "ordre@lunchportalen.no";
export const SUPPORT_EMAIL = "post@lunchportalen.no";

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

export function normEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function systemRoleByEmail(email: unknown): SystemRole | null {
  const e = normEmail(email);
  if (e === SYSTEM_EMAILS.SUPERADMIN) return "superadmin";
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
    e === SYSTEM_EMAILS.KITCHEN ||
    e === SYSTEM_EMAILS.DRIVER ||
    e === SYSTEM_EMAILS.DRIVER_ALIAS ||
    e === SYSTEM_EMAILS.ORDER ||
    e === SYSTEM_EMAILS.SUPPORT
  );
}
