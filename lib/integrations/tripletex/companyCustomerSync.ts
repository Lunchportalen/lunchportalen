import "server-only";

import {
  classifyTripletexError,
  ensureCompanyCustomer,
  resolveTripletexAuth,
  TripletexClientError,
  type TripletexAuth,
} from "@/lib/integrations/tripletex/client";

export type OutboxHandleResult = {
  ok: boolean;
  permanent?: boolean;
  error?: string;
};

export type CompanyCustomerCreateProviderOutboxRow = {
  id?: number;
  event_key: string;
  payload: unknown;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function parseIdsFromEventKey(eventKey: string): { companyId: string; providerId: string } {
  const prefix = "tripletex.company_customer_create_provider:";
  const key = safeStr(eventKey);
  if (!key.startsWith(prefix)) return { companyId: "", providerId: "" };
  const rest = safeStr(key.slice(prefix.length));
  const [companyId, providerId] = rest.split(":");
  return { companyId: safeStr(companyId), providerId: safeStr(providerId) };
}

function parsePayload(payload: unknown): {
  companyId: string;
  providerId: string;
  env: "test" | "prod";
  requestRid: string;
} {
  const p = (payload ?? {}) as Record<string, unknown>;
  const envRaw = safeStr(p.env ?? "prod").toLowerCase();
  return {
    companyId: safeStr(p.company_id ?? p.companyId),
    providerId: safeStr(p.provider_id ?? p.providerId),
    env: envRaw === "test" ? "test" : "prod",
    requestRid: safeStr(p.request_rid ?? p.requestRid),
  };
}

async function writeTripletexSyncAudit(
  admin: any,
  companyId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("lifecycle_audit_log").insert({
    actor_id: null,
    action: "company_provider_customer_created",
    entity_type: "tripletex_sync",
    entity_id: companyId,
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
 * TPT-B-2 — Process outbox event tripletex.company_customer_create_provider:<company_id>:<provider_id>
 */
export async function handleCompanyCustomerCreateProvider(
  admin: any,
  row: CompanyCustomerCreateProviderOutboxRow,
): Promise<OutboxHandleResult> {
  const payload = parsePayload(row.payload);
  const fromKey = parseIdsFromEventKey(row.event_key);
  const companyId = payload.companyId || fromKey.companyId;
  const providerId = payload.providerId || fromKey.providerId;
  const env = payload.env;

  if (!companyId || !providerId) {
    return { ok: false, permanent: true, error: "INVALID_PAYLOAD" };
  }

  try {
    const { data: existingMapping, error: mappingError } = await admin
      .from("tripletex_customers")
      .select("tripletex_customer_id")
      .eq("company_id", companyId)
      .eq("provider_id", providerId)
      .maybeSingle();

    if (mappingError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(mappingError?.message) || "TRIPLETEX_COMPANY_PROVIDER_MAPPING_LOOKUP_FAILED",
      };
    }

    const existingCustomerId = safeStr((existingMapping as any)?.tripletex_customer_id);
    if (existingCustomerId) {
      return { ok: true };
    }

    const { data: company, error: companyError } = await admin
      .from("companies")
      .select(
        "id,provider_id,orgnr,name,legal_name,billing_email,billing_address,billing_postcode,billing_city,billing_country,ehf_enabled,ehf_endpoint",
      )
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(companyError?.message) || "COMPANY_LOOKUP_FAILED",
      };
    }

    if (!company) {
      return { ok: false, permanent: true, error: "COMPANY_NOT_FOUND" };
    }

    if (safeStr((company as any).provider_id) !== providerId) {
      return { ok: false, permanent: true, error: "COMPANY_PROVIDER_MISMATCH" };
    }

    const orgnr = safeStr((company as any).orgnr);
    const legalName = safeStr((company as any).legal_name) || safeStr((company as any).name);
    const billingAddress = safeStr((company as any).billing_address);
    const billingPostcode = safeStr((company as any).billing_postcode);
    const billingCity = safeStr((company as any).billing_city);
    const billingCountry = safeStr((company as any).billing_country) || "NO";

    if (!orgnr || !legalName || !billingAddress || !billingPostcode || !billingCity) {
      return { ok: false, permanent: true, error: "COMPANY_BILLING_FIELDS_MISSING" };
    }

    const result = await ensureCompanyCustomer({
      admin,
      providerId,
      env,
      company: {
        id: companyId,
        orgnr,
        legal_name: legalName,
        billing_email: safeStr((company as any).billing_email) || null,
        billing_address: billingAddress,
        billing_postcode: billingPostcode,
        billing_city: billingCity,
        billing_country: billingCountry,
        ehf_enabled: Boolean((company as any).ehf_enabled),
        ehf_endpoint: safeStr((company as any).ehf_endpoint) || null,
      },
    });

    await writeTripletexSyncAudit(admin, companyId, {
      company_id: companyId,
      provider_id: providerId,
      env,
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

export async function createProviderRunAuthResolver(
  providerId: string,
  env: "test" | "prod" = "prod",
): Promise<() => Promise<TripletexAuth>> {
  let runAuthPromise: Promise<TripletexAuth> | null = null;
  return async () => {
    if (!runAuthPromise) {
      runAuthPromise = resolveTripletexAuth({ providerId, env });
    }
    return runAuthPromise;
  };
}
