/**
 * Canonical dev/harness passwords shared by local CMS runtime and remote-backend harness.
 * Email addresses live in lib/system/emails.ts (SUPERADMIN_EMAIL, REMOTE_BACKEND_HARNESS_EMAIL).
 */
export const CANONICAL_LOCAL_PROVIDER_CMS_PASSWORD = "Lunchportalen123!" as const;

export const CANONICAL_REMOTE_BACKEND_HARNESS_PASSWORD = CANONICAL_LOCAL_PROVIDER_CMS_PASSWORD;
