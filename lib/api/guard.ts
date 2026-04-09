import "server-only";

import { validateApiKey } from "@/lib/api/keys";
import { opsLog } from "@/lib/ops/log";

export type ApiTenantContext = { tenantId: string; purpose: string };

/**
 * Krever `x-api-key` — fail-closed. Logger gyldig oppslag (uten nøkkelverdi).
 */
export function requireApiKey(req: Request): ApiTenantContext {
  const key = req.headers.get("x-api-key") ?? req.headers.get("X-Api-Key");
  const data = validateApiKey(key);
  if (!data) {
    opsLog("api_key_rejected", { reason: "invalid_or_revoked" });
    throw new Error("INVALID_API_KEY");
  }
  return { tenantId: data.tenantId, purpose: data.purpose };
}

/** Alias — samme som `requireApiKey` (tenant = company_id for offentlig API). */
export function getTenantContext(req: Request): ApiTenantContext {
  return requireApiKey(req);
}
