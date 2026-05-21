import "server-only";

import {
  classifyTripletexError,
  ensureCompanyCustomer,
  ensureProviderProduct,
  ensureProviderVatCode,
  TripletexClientError,
} from "@/lib/integrations/tripletex/client";

export type OutboxHandleResult = {
  ok: boolean;
  permanent?: boolean;
  error?: string;
};

export type OnboardingProvisioningOutboxRow = {
  id?: number;
  event_key: string;
  payload: unknown;
};

const VAT_RATES = ["25", "15", "0"] as const;
const PRODUCT_TIERS = ["BASIS", "LUXUS", "ENTERPRISE"] as const;
const CONCURRENCY = 5;

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function parsePayload(payload: unknown): {
  providerId: string;
  env: "test" | "prod";
  requestRid: string;
} {
  const p = (payload ?? {}) as Record<string, unknown>;
  const envRaw = safeStr(p.env ?? "prod").toLowerCase();
  return {
    providerId: safeStr(p.provider_id ?? p.providerId),
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

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

type SkippedCustomer = {
  company_id: string;
  company_name: string | null;
  reason: string;
};

/**
 * TPT-B-7 — Process outbox event tripletex.onboarding_provisioning_start:<provider_id>:<env>
 */
export async function handleOnboardingProvisioningStart(
  admin: any,
  row: OnboardingProvisioningOutboxRow,
): Promise<OutboxHandleResult> {
  const payload = parsePayload(row.payload);
  const providerId = payload.providerId;
  const env = payload.env;
  const started = Date.now();

  if (!providerId) {
    return { ok: false, permanent: true, error: "INVALID_PAYLOAD" };
  }

  const skipped: SkippedCustomer[] = [];
  let vatEnsured = 0;
  let productsEnsured = 0;
  let customersEnsured = 0;

  try {
    const { data: taxRows, error: taxError } = await admin
      .from("billing_tax_codes")
      .select("id,rate")
      .in("rate", [25, 15, 0]);

    if (taxError) {
      return { ok: false, permanent: false, error: safeStr(taxError.message) || "TAX_LOOKUP_FAILED" };
    }

    const taxByRate = new Map<number, string>();
    for (const row of taxRows ?? []) {
      taxByRate.set(Number((row as any).rate), safeStr((row as any).id));
    }

    for (const rate of VAT_RATES) {
      const taxCodeId = taxByRate.get(Number(rate));
      if (!taxCodeId) continue;
      await ensureProviderVatCode({ admin, providerId, taxCodeId, env });
      vatEnsured += 1;
    }

    for (const tier of PRODUCT_TIERS) {
      await ensureProviderProduct({ admin, providerId, tier, env });
      productsEnsured += 1;
    }

    const { data: agreements, error: agrError } = await admin
      .from("agreements")
      .select("company_id, status")
      .eq("provider_id", providerId)
      .eq("status", "ACTIVE");

    if (agrError) {
      return { ok: false, permanent: false, error: safeStr(agrError.message) || "AGREEMENTS_LOOKUP_FAILED" };
    }

    const companyIds: string[] = Array.from(
      new Set(
        (agreements ?? [])
          .map((a: { company_id?: string }) => safeStr(a.company_id))
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const customerResults = await mapWithConcurrency(companyIds, CONCURRENCY, async (companyId) => {
      const { data: company, error: companyError } = await admin
        .from("companies")
        .select(
          "id, orgnr, legal_name, name, billing_email, billing_address, billing_postcode, billing_city, billing_country, ehf_enabled, ehf_endpoint",
        )
        .eq("id", companyId)
        .maybeSingle();

      if (companyError || !company) {
        skipped.push({
          company_id: companyId,
          company_name: null,
          reason: "COMPANY_NOT_FOUND",
        });
        return false;
      }

      const c = company as Record<string, unknown>;
      const orgnr = safeStr(c.orgnr);
      if (!orgnr) {
        skipped.push({
          company_id: companyId,
          company_name: safeStr(c.legal_name ?? c.name) || null,
          reason: "MISSING_ORG_NUMBER",
        });
        return false;
      }

      try {
        await ensureCompanyCustomer({
          admin,
          providerId,
          company: {
            id: companyId,
            orgnr,
            legal_name: safeStr(c.legal_name ?? c.name) || "Unknown",
            billing_email: (c.billing_email as string | null) ?? null,
            billing_address: safeStr(c.billing_address) || "—",
            billing_postcode: safeStr(c.billing_postcode) || "0001",
            billing_city: safeStr(c.billing_city) || "Oslo",
            billing_country: safeStr(c.billing_country) || "NO",
            ehf_enabled: Boolean(c.ehf_enabled),
            ehf_endpoint: (c.ehf_endpoint as string | null) ?? null,
          },
          env,
        });
        return true;
      } catch (error: unknown) {
        skipped.push({
          company_id: companyId,
          company_name: safeStr(c.legal_name ?? c.name) || null,
          reason: safeStr((error as Error)?.message ?? error) || "ENSURE_CUSTOMER_FAILED",
        });
        return false;
      }
    });

    customersEnsured = customerResults.filter(Boolean).length;

    const durationMs = Date.now() - started;
    const summary = {
      vat_codes_ensured: vatEnsured,
      products_ensured: productsEnsured,
      customers_ensured: customersEnsured,
      customers_skipped: skipped.length,
      skipped_details: skipped,
      duration_ms: durationMs,
      started_at: new Date(started).toISOString(),
    };

    const { error: rpcError } = await admin.rpc("lp_provider_complete_onboarding_provisioning", {
      p_provider_id: providerId,
      p_env: env,
      p_summary: summary,
    });

    if (rpcError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(rpcError.message) || "PROVISIONING_RPC_FAILED",
      };
    }

    return { ok: true };
  } catch (error: unknown) {
    const classified = classifyHandlerError(error);
    if (classified.permanent) {
      return { ok: false, permanent: true, error: classified.message };
    }
    return { ok: false, permanent: false, error: classified.message };
  }
}
