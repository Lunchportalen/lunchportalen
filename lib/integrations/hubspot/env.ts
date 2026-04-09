import "server-only";

import { throwError } from "@/lib/core/errors";

/**
 * Private app token (Bearer). Never log or return to clients.
 */
export function getHubspotToken(): string {
  const token = typeof process.env.HUBSPOT_API_KEY === "string" ? process.env.HUBSPOT_API_KEY.trim() : "";
  if (!token) {
    throwError({
      code: "HUBSPOT_MISSING_TOKEN",
      message: "Missing HUBSPOT_API_KEY",
      source: "hubspot",
      severity: "high",
    });
  }
  return token;
}

export function isHubspotConfigured(): boolean {
  return Boolean(typeof process.env.HUBSPOT_API_KEY === "string" && process.env.HUBSPOT_API_KEY.trim());
}
