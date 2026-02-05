// lib/system/emails.ts

export const SUPERADMIN_EMAIL = "superadmin@lunchportalen.no";
export const KITCHEN_EMAIL = "kjokken@lunchportalen.no";
export const DRIVER_EMAIL = "driver@lunchportalen.no";
export const DRIVER_ALIAS_EMAIL = "sjafor@lunchportalen.no";
export const ORDER_EMAIL = "ordre@lunchportalen.no";
export const SUPPORT_EMAIL = "post@lunchportalen.no";

export const SYSTEM_EMAIL_ALLOWLIST = (() => {
  const raw = process.env.SYSTEM_EMAIL_ALLOWLIST;
  const list = (raw
    ? raw.split(",")
    : [ORDER_EMAIL, "noreply@lunchportalen.no"]
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
  if (e === SUPERADMIN_EMAIL) return "superadmin";
  if (e === KITCHEN_EMAIL) return "kitchen";
  if (e === DRIVER_EMAIL || e === DRIVER_ALIAS_EMAIL) return "driver";
  return null;
}

export function isSuperadminEmail(email: unknown): boolean {
  return normEmail(email) === SUPERADMIN_EMAIL;
}

export function isSystemEmail(email: unknown): boolean {
  const e = normEmail(email);
  return (
    e === SUPERADMIN_EMAIL ||
    e === KITCHEN_EMAIL ||
    e === DRIVER_EMAIL ||
    e === DRIVER_ALIAS_EMAIL ||
    e === ORDER_EMAIL ||
    e === SUPPORT_EMAIL
  );
}
