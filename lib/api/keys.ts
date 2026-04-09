import "server-only";

import { randomUUID } from "node:crypto";

import { opsLog } from "@/lib/ops/log";

export type ApiKeyRecord = {
  tenantId: string;
  createdAt: number;
  /** Formål (data minimization / dokumentasjon). */
  purpose: "integration_read_orders" | "integration_custom";
  revokedAt: number | null;
};

const keys = new Map<string, ApiKeyRecord>();

/**
 * In-memory nøkkelring (MVP). Reversibel via `revokeApiKey`.
 * Produksjon: flytt til DB med hash-lagring og rotasjon.
 */
export function createApiKey(
  tenantId: string,
  opts?: { purpose?: ApiKeyRecord["purpose"] },
): { key: string; record: ApiKeyRecord } {
  const id = String(tenantId ?? "").trim();
  if (!id) {
    throw new Error("MISSING_TENANT_ID");
  }
  const key = randomUUID();
  const record: ApiKeyRecord = {
    tenantId: id,
    createdAt: Date.now(),
    purpose: opts?.purpose ?? "integration_read_orders",
    revokedAt: null,
  };
  keys.set(key, record);
  opsLog("api_key_created", { tenantId: id, purpose: record.purpose, keySuffix: key.slice(-8) });
  return { key, record };
}

export function validateApiKey(key: string | null | undefined): ApiKeyRecord | null {
  if (key == null || typeof key !== "string" || !key.trim()) return null;
  const rec = keys.get(key.trim());
  if (!rec || rec.revokedAt != null) return null;
  return rec;
}

export function revokeApiKey(key: string): boolean {
  const k = String(key ?? "").trim();
  const rec = keys.get(k);
  if (!rec) return false;
  rec.revokedAt = Date.now();
  keys.set(k, rec);
  opsLog("api_key_revoked", { tenantId: rec.tenantId, keySuffix: k.slice(-8) });
  return true;
}

/** Kun diagnostikk — ingen nøkkelmaterial. */
export function listApiKeyMetaForTenant(tenantId: string): Array<{ createdAt: number; purpose: string; revoked: boolean }> {
  const tid = String(tenantId ?? "").trim();
  const out: Array<{ createdAt: number; purpose: string; revoked: boolean }> = [];
  for (const [, rec] of keys) {
    if (rec.tenantId !== tid) continue;
    out.push({
      createdAt: rec.createdAt,
      purpose: rec.purpose,
      revoked: rec.revokedAt != null,
    });
  }
  return out;
}
