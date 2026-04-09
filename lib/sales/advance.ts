import "server-only";

import { throwError } from "@/lib/core/errors";

/**
 * HubSpot deal advancement is blocked until explicit approval exists in ops / CRM.
 * Never PATCH HubSpot from this path without a reviewed approval gate.
 */
export async function advanceDeal(_dealId: string): Promise<never> {
  void _dealId;
  throwError({
    code: "CLOSING_REQUIRES_APPROVAL",
    message: "Manuell godkjenning kreves før deal kan flyttes.",
    source: "sales",
    severity: "high",
  });
}
