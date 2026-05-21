import "server-only";

import {
  classifyTripletexError,
  createInvoice,
  resolveTripletexAuth,
  TripletexClientError,
  type TripletexAuth,
} from "@/lib/integrations/tripletex/client";

export type OutboxHandleResult = {
  ok: boolean;
  permanent?: boolean;
  error?: string;
};

export type SaasInvoiceCreateOutboxRow = {
  id?: number;
  event_key: string;
  payload: unknown;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function saasInvoiceUniqueRef(invoiceId: string): string {
  return `lp_saas:${invoiceId}`;
}

function parseInvoiceIdFromEventKey(eventKey: string): string {
  const prefix = "tripletex.saas_invoice_create_lp:";
  const key = safeStr(eventKey);
  if (!key.startsWith(prefix)) return "";
  return safeStr(key.slice(prefix.length));
}

function parsePayload(payload: unknown): {
  invoiceId: string;
  providerId: string;
  target: string;
  requestRid: string;
} {
  const p = (payload ?? {}) as Record<string, unknown>;
  return {
    invoiceId: safeStr(p.invoice_id ?? p.invoiceId),
    providerId: safeStr(p.provider_id ?? p.providerId),
    target: safeStr(p.target),
    requestRid: safeStr(p.request_rid ?? p.requestRid),
  };
}

async function writeTripletexSyncAudit(
  admin: any,
  providerId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("lifecycle_audit_log").insert({
    actor_id: null,
    action: "provider_saas_invoice_created",
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

function resolveSaasProductId(): string {
  const productId = safeStr(process.env.TRIPLETEX_REVENUE_DEFAULT_PRODUCT_ID);
  if (!productId) {
    throw new TripletexClientError({
      message: "TRIPLETEX_REVENUE_DEFAULT_PRODUCT_ID is required for SaaS invoices",
      kind: "CONFIG_MISSING",
      code: "TRIPLETEX_SAAS_PRODUCT_MISSING",
    });
  }
  return productId;
}

function resolveVatCode(taxTripletexVatCode: string | null): string {
  const fromTax = safeStr(taxTripletexVatCode);
  if (fromTax) return fromTax;
  const fallback = safeStr(process.env.TRIPLETEX_REVENUE_DEFAULT_VAT_CODE);
  if (!fallback) {
    throw new TripletexClientError({
      message: "tripletex_vat_code missing on tax code and TRIPLETEX_REVENUE_DEFAULT_VAT_CODE unset",
      kind: "CONFIG_MISSING",
      code: "TRIPLETEX_VAT_CODE_MISSING",
    });
  }
  return fallback;
}

/**
 * TPT-A-4 — Process outbox event tripletex.saas_invoice_create_lp:<invoice_id>
 */
export async function handleSaasInvoiceCreateLp(
  admin: any,
  row: SaasInvoiceCreateOutboxRow,
  getRunAuth: () => Promise<TripletexAuth>,
): Promise<OutboxHandleResult> {
  const payload = parsePayload(row.payload);
  const invoiceId = payload.invoiceId || parseInvoiceIdFromEventKey(row.event_key);
  const providerId = payload.providerId;

  if (!invoiceId) {
    return { ok: false, permanent: true, error: "INVALID_PAYLOAD" };
  }

  if (payload.target && payload.target !== "lp") {
    return { ok: false, permanent: true, error: "INVALID_PAYLOAD_TARGET" };
  }

  const uniqueRef = saasInvoiceUniqueRef(invoiceId);

  try {
    const { data: localExport, error: exportError } = await admin
      .from("tripletex_exports")
      .select("tripletex_invoice_id")
      .eq("unique_ref", uniqueRef)
      .maybeSingle();

    if (exportError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(exportError?.message) || "TRIPLETEX_EXPORT_LOOKUP_FAILED",
      };
    }

    const existingExportId = safeStr((localExport as any)?.tripletex_invoice_id);
    if (existingExportId) {
      await admin
        .from("provider_invoices")
        .update({
          status: "SENT",
          tripletex_invoice_id: existingExportId,
          sent_at: new Date().toISOString(),
        })
        .eq("id", invoiceId)
        .eq("status", "DRAFT");
      return { ok: true };
    }

    const { data: invoice, error: invoiceError } = await admin
      .from("provider_invoices")
      .select(
        "id,provider_id,invoice_number,invoice_period,amount_net,amount_tax,amount_total,tax_code_id,status,tripletex_invoice_id",
      )
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(invoiceError?.message) || "PROVIDER_INVOICE_LOOKUP_FAILED",
      };
    }

    if (!invoice) {
      return { ok: false, permanent: true, error: "PROVIDER_INVOICE_NOT_FOUND" };
    }

    const resolvedProviderId = providerId || safeStr((invoice as any).provider_id);
    const invoiceStatus = safeStr((invoice as any).status);

    if (invoiceStatus === "SENT" || safeStr((invoice as any).tripletex_invoice_id)) {
      return { ok: true };
    }

    if (invoiceStatus !== "DRAFT") {
      return { ok: false, permanent: true, error: "PROVIDER_INVOICE_NOT_DRAFT" };
    }

    const amountNet = safeNum((invoice as any).amount_net);
    if (amountNet <= 0) {
      return { ok: false, permanent: true, error: "PROVIDER_INVOICE_AMOUNT_INVALID" };
    }

    const { data: customerMapping, error: customerError } = await admin
      .from("tripletex_customers")
      .select("tripletex_customer_id")
      .eq("provider_id", resolvedProviderId)
      .is("company_id", null)
      .maybeSingle();

    if (customerError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(customerError?.message) || "TRIPLETEX_PROVIDER_MAPPING_LOOKUP_FAILED",
      };
    }

    const customerId = safeStr((customerMapping as any)?.tripletex_customer_id);
    if (!customerId) {
      return { ok: false, permanent: true, error: "TRIPLETEX_PROVIDER_CUSTOMER_MISSING" };
    }

    const taxCodeId = safeStr((invoice as any).tax_code_id);
    let tripletexVatCode: string | null = null;
    if (taxCodeId) {
      const { data: taxCode, error: taxError } = await admin
        .from("billing_tax_codes")
        .select("tripletex_vat_code")
        .eq("id", taxCodeId)
        .maybeSingle();

      if (taxError) {
        return {
          ok: false,
          permanent: false,
          error: safeStr(taxError?.message) || "BILLING_TAX_CODE_LOOKUP_FAILED",
        };
      }
      tripletexVatCode = safeStr((taxCode as any)?.tripletex_vat_code) || null;
    }

    const productId = resolveSaasProductId();
    const vatCode = resolveVatCode(tripletexVatCode);
    const periodLabel = safeStr((invoice as any).invoice_period) || "period";
    const invoiceNumber = safeStr((invoice as any).invoice_number);

    const tripletexResult = await createInvoice({
      uniqueRef,
      customerId,
      productId,
      invoiceLine: {
        quantity: 1,
        unit_price: amountNet,
        product_name: invoiceNumber
          ? `Lunchportalen SaaS ${invoiceNumber}`
          : `Lunchportalen SaaS ${periodLabel}`,
        tripletex_vat_code: vatCode,
        currency: "NOK",
      },
      request: { auth: await getRunAuth() },
    });

    const tripletexInvoiceId = safeStr(tripletexResult.externalId);
    if (!tripletexInvoiceId) {
      return { ok: false, permanent: true, error: "TRIPLETEX_INVOICE_ID_MISSING" };
    }

    const { error: exportUpsertError } = await admin.from("tripletex_exports").upsert(
      {
        unique_ref: uniqueRef,
        tripletex_invoice_id: tripletexInvoiceId,
        created_at: new Date().toISOString(),
      },
      { onConflict: "unique_ref" },
    );

    if (exportUpsertError) {
      throw new TripletexClientError({
        message: `tripletex_exports upsert failed: ${safeStr(exportUpsertError?.message ?? exportUpsertError)}`,
        kind: "TRANSIENT",
        code: "TRIPLETEX_EXPORT_UPSERT_FAILED",
        detail: exportUpsertError,
      });
    }

    const { error: invoiceUpdateError } = await admin
      .from("provider_invoices")
      .update({
        status: "SENT",
        tripletex_invoice_id: tripletexInvoiceId,
        sent_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .eq("status", "DRAFT");

    if (invoiceUpdateError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(invoiceUpdateError?.message) || "PROVIDER_INVOICE_UPDATE_FAILED",
      };
    }

    await writeTripletexSyncAudit(admin, resolvedProviderId, {
      provider_id: resolvedProviderId,
      invoice_id: invoiceId,
      tripletex_invoice_id: tripletexInvoiceId,
      unique_ref: uniqueRef,
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
