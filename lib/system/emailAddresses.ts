/**
 * Edge-safe system email string constants only.
 * Middleware and other Edge bundles may import this module; it must not evaluate env or throw at import time.
 * Heavier logic (allowlists, role helpers) lives in `emails.ts`.
 */
export const SUPERADMIN_EMAIL = "superadmin@lunchportalen.no";
export const KITCHEN_EMAIL = "kjokken@lunchportalen.no";
export const DRIVER_EMAIL = "driver@lunchportalen.no";
export const DRIVER_ALIAS_EMAIL = "sjafor@lunchportalen.no";
export const ORDER_EMAIL = "ordre@lunchportalen.no";
export const SUPPORT_EMAIL = "post@lunchportalen.no";
export const REMOTE_BACKEND_HARNESS_EMAIL = "remote-backend-harness@lunchportalen.no";
