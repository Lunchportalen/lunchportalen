import "server-only";

import { getSanityReadConfig } from "@/lib/config/env";

/**
 * Base URL for Sanity Studio (redigering av meny m.m.).
 * Foretrekk eksplisitt env i deploy; ellers heuristikk fra `projectId`.
 */
export function getSanityStudioBaseUrl(): string {
  const explicit =
    String(process.env.NEXT_PUBLIC_SANITY_STUDIO_URL ?? "").trim() ||
    String(process.env.SANITY_STUDIO_URL ?? "").trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const { projectId } = getSanityReadConfig();
  return `https://${projectId}.sanity.studio`;
}
