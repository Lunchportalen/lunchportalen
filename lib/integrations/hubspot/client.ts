import "server-only";

import { throwError } from "@/lib/core/errors";

import { getHubspotToken } from "@/lib/integrations/hubspot/env";

export type HubspotJson = Record<string, unknown>;

/**
 * Deterministic HubSpot CRM request. Does not log secrets.
 */
export async function hubspotFetch(path: string, init: RequestInit = {}): Promise<HubspotJson> {
  const token = getHubspotToken();
  const url = `https://api.hubapi.com${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init.headers ?? undefined);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    throwError({
      code: "HUBSPOT_API_FAILED",
      message: `${path} failed (${res.status})`,
      source: "hubspot",
      severity: "high",
    });
  }

  return (parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}) as HubspotJson;
}
