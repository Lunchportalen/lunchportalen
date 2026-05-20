import "server-only";

import {
  classifyTripletexError,
  ensureProviderCustomer,
  resolveTripletexAuth,
  TripletexClientError,
  type TripletexAuth,
} from "@/lib/integrations/tripletex/client";

export type OutboxHandleResult = {
  ok: boolean;
  permanent?: boolean;
  error?: string;
};

export type ProviderCustomerCreateOutboxRow = {
  id?: number;
  event_key: string;
  payload: unknown;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function parseProviderIdFromEventKey(eventKey: string): string {
  const prefix = "tripletex.provider_customer_create_lp:";
  const key = safeStr(eventKey);
  if (!key.startsWith(prefix)) return "";
  return safeStr(key.slice(prefix.length));
}

function parsePayload(payload: unknown): { providerId: string; target: string; requestRid: string } {
  const p = (payload ?? {}) as Record<string, unknown>;
  const providerId = safeStr(p.provider_id ?? p.providerId);
  const target = safeStr(p.target);
  const requestRid = safeStr(p.request_rid ?? p.requestRid);
  return { providerId, target, requestRid };
}

async function writeTripletexSyncAudit(
  admin: any,
  providerId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("lifecycle_audit_log").insert({
    actor_id: null,
    action: "provider_customer_created",
    entity_type: "tripletex_sync",
    entity_id: providerId,
    reason: null,
    metadata,
  });

  if (error) {
    throw new TripletexClientError({
      message: `Tripletex sync audit insert failed: ${safeStr(error?.message ?? error)}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_SYNC_AUDIT_INSERT_FAILED",
      detail: error,
    });
  }
}

function classifyHandlerError(error: unknown): { message: string; permanent: boolean } {
  if (error instanceof TripletexClientError) {
    return {
      message: error.message,
      permanent:
        error.kind === "CONFIG_MISSING" ||
        error.kind === "AUTH" ||
        error.kind === "PERMANENT" ||
        error.kind === "PROVIDER_CREDENTIALS_NOT_IMPLEMENTED",
    };
  }

  const asTripletex = classifyTripletexError(error);
  return {
    message: asTripletex.message,
    permanent:
      asTripletex.kind === "CONFIG_MISSING" ||
      asTripletex.kind === "AUTH" ||
      asTripletex.kind === "PERMANENT" ||
      asTripletex.kind === "PROVIDER_CREDENTIALS_NOT_IMPLEMENTED",
  };
}

/**
 * TPT-A-3 — Process outbox event tripletex.provider_customer_create_lp:<provider_id>
 */
export async function handleProviderCustomerCreateLp(
  admin: any,
  row: ProviderCustomerCreateOutboxRow,
  getRunAuth: () => Promise<TripletexAuth>,
): Promise<OutboxHandleResult> {
  const payload = parsePayload(row.payload);
  const providerId = payload.providerId || parseProviderIdFromEventKey(row.event_key);

  if (!providerId) {
    return { ok: false, permanent: true, error: "INVALID_PAYLOAD" };
  }

  if (payload.target && payload.target !== "lp") {
    return { ok: false, permanent: true, error: "INVALID_PAYLOAD_TARGET" };
  }

  try {
    const { data: existingMapping, error: mappingError } = await admin
      .from("tripletex_customers")
      .select("tripletex_customer_id")
      .eq("provider_id", providerId)
      .is("company_id", null)
      .maybeSingle();

    if (mappingError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(mappingError?.message) || "TRIPLETEX_PROVIDER_MAPPING_LOOKUP_FAILED",
      };
    }

    const existingCustomerId = safeStr((existingMapping as any)?.tripletex_customer_id);
    if (existingCustomerId) {
      return { ok: true };
    }

    const { data: provider, error: providerError } = await admin
      .from("providers")
      .select("id,name,org_number,contact_email")
      .eq("id", providerId)
      .maybeSingle();

    if (providerError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(providerError?.message) || "PROVIDER_LOOKUP_FAILED",
      };
    }

    if (!provider) {
      return { ok: false, permanent: true, error: "PROVIDER_NOT_FOUND" };
    }

    let billingAddress: string | null = null;
    const billingPostcode: string | null = null;
    const billingCity: string | null = null;

    const { data: subscription } = await admin
      .from("provider_subscriptions")
      .select("billing_address,billing_org_number")
      .eq("provider_id", providerId)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscription) {
      billingAddress = safeStr((subscription as any).billing_address) || null;
      const subOrg = safeStr((subscription as any).billing_org_number);
      if (subOrg && !safeStr((provider as any).org_number)) {
        (provider as any).org_number = subOrg;
      }
    }

    const result = await ensureProviderCustomer({
      admin,
      provider: {
        id: providerId,
        name: safeStr((provider as any).name),
        org_number: safeStr((provider as any).org_number) || null,
        contact_email: safeStr((provider as any).contact_email),
        billing_address: billingAddress,
        billing_postcode: billingPostcode,
        billing_city: billingCity,
        billing_country: "NO",
      },
      request: { auth: await getRunAuth() },
    });

    await writeTripletexSyncAudit(admin, providerId, {
      provider_id: providerId,
      tripletex_customer_id: result.customerId,
      created: result.created,
      request_rid: payload.requestRid || null,
      event_key: row.event_key,
    });

    return { ok: true };
  } catch (error: unknown) {
    const classified = classifyHandlerError(error);
    return { ok: false, permanent: classified.permanent, error: classified.message };
  }
}

export async function createLpRunAuthResolver(): Promise<() => Promise<TripletexAuth>> {
  let runAuthPromise: Promise<TripletexAuth> | null = null;
  return async () => {
    if (!runAuthPromise) {
      runAuthPromise = resolveTripletexAuth();
    }
    return runAuthPromise;
  };
}
