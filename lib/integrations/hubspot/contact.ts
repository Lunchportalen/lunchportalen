import "server-only";

import { throwError } from "@/lib/core/errors";

import { hubspotFetch } from "@/lib/integrations/hubspot/client";

/**
 * Idempotent upsert by email (HubSpot batch upsert with `idProperty: email`).
 */
export async function upsertContact(email: string, props: Record<string, string> = {}) {
  const clean = email.trim().toLowerCase();
  if (!clean.includes("@")) {
    throwError({
      code: "HUBSPOT_INVALID_EMAIL",
      message: "Invalid email for HubSpot upsert",
      source: "hubspot",
      severity: "high",
    });
  }

  const properties: Record<string, string> = { email: clean, ...props };

  return hubspotFetch("/crm/v3/objects/contacts/batch/upsert", {
    method: "POST",
    body: JSON.stringify({
      inputs: [
        {
          id: clean,
          idProperty: "email",
          properties,
        },
      ],
    }),
  });
}
