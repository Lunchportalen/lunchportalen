/**
 * Sanity CLI scripts: explicit project id from env only (no hardcoded fallback).
 * Canonical production project: 4udoq5d8 (verified Vercel + live CMS, P3.H3-REVERSE 2026-05-19).
 */
export function requireSanityProjectIdFromEnv(): string {
  const v =
    String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "").trim() ||
    String(process.env.SANITY_PROJECT_ID ?? "").trim();
  if (!v) {
    console.error(
      "FAIL: NEXT_PUBLIC_SANITY_PROJECT_ID eller SANITY_PROJECT_ID må settes før kjøring.",
    );
    process.exit(1);
  }
  return v;
}
