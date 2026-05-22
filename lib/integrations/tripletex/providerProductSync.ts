import "server-only";

import {
  classifyTripletexError,
  ensureProviderProduct,
  TripletexClientError,
} from "@/lib/integrations/tripletex/client";

export type OutboxHandleResult = {
  ok: boolean;
  permanent?: boolean;
  error?: string;
};

export type ProviderProductSyncOutboxRow = {
  id?: string | number;
  event_key: string;
  payload: unknown;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function parseIdsFromEventKey(eventKey: string): { providerId: string; tier: string } {
  const prefix = "tripletex.provider_product_sync:";
  const key = safeStr(eventKey);
  if (!key.startsWith(prefix)) return { providerId: "", tier: "" };
  const rest = safeStr(key.slice(prefix.length));
  const [providerId, tier] = rest.split(":");
  return { providerId: safeStr(providerId), tier: safeStr(tier).toUpperCase() };
}

function parsePayload(payload: unknown): {
  providerId: string;
  tier: string;
  env: "test" | "prod";
  requestRid: string;
} {
  const p = (payload ?? {}) as Record<string, unknown>;
  const envRaw = safeStr(p.env ?? "prod").toLowerCase();
  return {
    providerId: safeStr(p.provider_id ?? p.providerId),
    tier: safeStr(p.tier).toUpperCase(),
    env: envRaw === "test" ? "test" : "prod",
    requestRid: safeStr(p.request_rid ?? p.requestRid),
  };
}

function classifyHandlerError(error: unknown): { message: string; permanent: boolean } {
  if (error instanceof TripletexClientError) {
    return {
      message: error.message,
      permanent:
        error.kind === "CONFIG_MISSING" ||
        error.kind === "AUTH" ||
        error.kind === "PERMANENT" ||
        error.kind === "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
    };
  }

  const asTripletex = classifyTripletexError(error);
  return {
    message: asTripletex.message,
    permanent:
      asTripletex.kind === "CONFIG_MISSING" ||
      asTripletex.kind === "AUTH" ||
      asTripletex.kind === "PERMANENT" ||
      asTripletex.kind === "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
  };
}

/**
 * TPT-B-5b — Process outbox event tripletex.provider_product_sync:<provider_id>:<tier>
 */
export async function handleProviderProductSync(
  admin: any,
  row: ProviderProductSyncOutboxRow,
): Promise<OutboxHandleResult> {
  const payload = parsePayload(row.payload);
  const fromKey = parseIdsFromEventKey(row.event_key);
  const providerId = payload.providerId || fromKey.providerId;
  const tier = payload.tier || fromKey.tier;
  const env = payload.env;

  if (!providerId || !tier) {
    return { ok: false, permanent: true, error: "INVALID_PAYLOAD" };
  }

  if (tier !== "BASIS" && tier !== "LUXUS" && tier !== "ENTERPRISE") {
    return { ok: false, permanent: true, error: "INVALID_TIER" };
  }

  try {
    const result = await ensureProviderProduct({
      admin,
      providerId,
      tier,
      env,
    });

    const { error: auditError } = await admin.from("lifecycle_audit_log").insert({
      actor_id: null,
      action: "provider_product_synced",
      entity_type: "tripletex_sync",
      entity_id: providerId,
      reason: null,
      metadata: {
        provider_id: providerId,
        tier,
        env,
        tripletex_product_id: result.productId,
        tripletex_vat_code: result.vatCode,
        created: result.created,
        request_rid: payload.requestRid || null,
        event_key: row.event_key,
        source: "agreement_lifecycle",
      },
    });

    if (auditError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(auditError?.message) || "TRIPLETEX_SYNC_AUDIT_INSERT_FAILED",
      };
    }

    return { ok: true };
  } catch (error: unknown) {
    const classified = classifyHandlerError(error);
    return { ok: false, permanent: classified.permanent, error: classified.message };
  }
}
