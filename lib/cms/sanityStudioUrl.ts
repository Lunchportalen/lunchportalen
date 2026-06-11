import "server-only";

import { getSanityReadConfig } from "@/lib/config/env";

/**
 * Base URL for Sanity Studio (redigering av meny m.m.).
 * Foretrekk eksplisitt env i deploy; ellers heuristikk fra `projectId`.
 */
export function getSanityStudioBaseUrl(): string {
  const explicit = getVerifiedSanityStudioBaseUrl();
  if (explicit) return explicit;

  const { projectId } = getSanityReadConfig();
  return `https://${projectId}.sanity.studio`;
}

/**
 * Verifisert Studio-URL for eksterne flater (leverandørportalen).
 * Kun eksplisitt env godtas — heuristikk fra `projectId` er ikke verifisert
 * (host kan mangle deploy) og skal aldri eksponeres mot leverandører.
 * Returnerer null hvis ingen verifisert URL er konfigurert (fail-closed).
 */
export function getVerifiedSanityStudioBaseUrl(): string | null {
  const explicit =
    String(process.env.NEXT_PUBLIC_SANITY_STUDIO_URL ?? "").trim() ||
    String(process.env.SANITY_STUDIO_URL ?? "").trim();
  if (!explicit) return null;
  if (!/^https:\/\//i.test(explicit)) return null;
  return explicit.replace(/\/$/, "");
}
