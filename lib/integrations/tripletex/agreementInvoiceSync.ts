import "server-only";

import {
  classifyTripletexError,
  createInvoice,
  ensureProviderProduct,
  ensureProviderVatCode,
  resolveTripletexAuth,
  TripletexClientError,
  type TripletexAuth,
} from "@/lib/integrations/tripletex/client";

export type OutboxHandleResult = {
  ok: boolean;
  permanent?: boolean;
  error?: string;
};

export type AgreementInvoiceCreateOutboxRow = {
  id?: number;
  event_key: string;
  payload: unknown;
};

type InvoiceLineRow = {
  product_key: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_amount: number;
  vat_rate: number;
  vat_amount: number;
  tax_code_id: string;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function agreementInvoiceUniqueRef(invoiceId: string): string {
  return `lp_agreement:${invoiceId}`;
}

function parseInvoiceIdFromEventKey(eventKey: string): string {
  const prefix = "tripletex.agreement_invoice_create_provider:";
  const key = safeStr(eventKey);
  if (!key.startsWith(prefix)) return "";
  return safeStr(key.slice(prefix.length));
}

function parsePayload(payload: unknown): {
  invoiceId: string;
  providerId: string;
  agreementId: string;
  target: string;
  requestRid: string;
} {
  const p = (payload ?? {}) as Record<string, unknown>;
  return {
    invoiceId: safeStr(p.invoice_id ?? p.invoiceId),
    providerId: safeStr(p.provider_id ?? p.providerId),
    agreementId: safeStr(p.agreement_id ?? p.agreementId),
    target: safeStr(p.target),
    requestRid: safeStr(p.request_rid ?? p.requestRid),
  };
}

function parseTripletexIdFromConflictDetail(detail: unknown): string {
  const d = detail as Record<string, unknown> | null;
  if (!d) return "";
  const value = d.value as Record<string, unknown> | undefined;
  const candidates = [value?.id, d.id, value?.invoiceId, d.invoiceId, value?.orderId, d.orderId];
  for (const c of candidates) {
    const id = safeStr(c);
    if (id) return id;
  }
  return "";
}

function productKeyToTier(productKey: string): "BASIS" | "LUXUS" | "ENTERPRISE" {
  const key = safeStr(productKey).toUpperCase();
  if (key === "LUXUS") return "LUXUS";
  if (key === "ENTERPRISE") return "ENTERPRISE";
  return "BASIS";
}

async function writeTripletexSyncAudit(
  admin: any,
  invoiceId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("lifecycle_audit_log").insert({
    actor_id: null,
    action: "agreement_provider_invoice_created",
    entity_type: "tripletex_sync",
    entity_id: invoiceId,
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

async function markInvoiceSent(
  admin: any,
  invoiceId: string,
  tripletexInvoiceId: string,
): Promise<OutboxHandleResult | null> {
  const { error: invoiceUpdateError } = await admin
    .from("agreement_invoices")
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
      error: safeStr(invoiceUpdateError?.message) || "AGREEMENT_INVOICE_UPDATE_FAILED",
    };
  }

  return null;
}

/**
 * TPT-B-4 — Process outbox event tripletex.agreement_invoice_create_provider:<invoice_id>
 */
export async function handleAgreementInvoiceCreateProvider(
  admin: any,
  row: AgreementInvoiceCreateOutboxRow,
): Promise<OutboxHandleResult> {
  const payload = parsePayload(row.payload);
  const invoiceId = payload.invoiceId || parseInvoiceIdFromEventKey(row.event_key);

  if (!invoiceId) {
    return { ok: false, permanent: true, error: "INVALID_PAYLOAD" };
  }

  if (payload.target && payload.target !== "provider") {
    return { ok: false, permanent: true, error: "INVALID_PAYLOAD_TARGET" };
  }

  const uniqueRef = agreementInvoiceUniqueRef(invoiceId);

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
      const updateErr = await markInvoiceSent(admin, invoiceId, existingExportId);
      if (updateErr) return updateErr;
      return { ok: true };
    }

    const { data: invoice, error: invoiceError } = await admin
      .from("agreement_invoices")
      .select(
        "id,agreement_id,provider_id,company_id,invoice_number,invoice_period_start,invoice_period_end,amount_net,amount_tax,amount_total,status,tripletex_invoice_id",
      )
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(invoiceError?.message) || "AGREEMENT_INVOICE_LOOKUP_FAILED",
      };
    }

    if (!invoice) {
      return { ok: false, permanent: true, error: "AGREEMENT_INVOICE_NOT_FOUND" };
    }

    const providerId = payload.providerId || safeStr((invoice as any).provider_id);
    const companyId = safeStr((invoice as any).company_id);
    const invoiceStatus = safeStr((invoice as any).status);
    const existingTripletexId = safeStr((invoice as any).tripletex_invoice_id);

    if (invoiceStatus === "SENT" || existingTripletexId) {
      return { ok: true };
    }

    if (invoiceStatus !== "DRAFT") {
      return { ok: false, permanent: true, error: "AGREEMENT_INVOICE_NOT_DRAFT" };
    }

    const amountNet = safeNum((invoice as any).amount_net);
    if (amountNet <= 0) {
      return { ok: false, permanent: true, error: "AGREEMENT_INVOICE_AMOUNT_INVALID" };
    }

    const { data: customerMapping, error: customerError } = await admin
      .from("tripletex_customers")
      .select("tripletex_customer_id")
      .eq("provider_id", providerId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (customerError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(customerError?.message) || "TRIPLETEX_CUSTOMER_MAPPING_LOOKUP_FAILED",
      };
    }

    const customerId = safeStr((customerMapping as any)?.tripletex_customer_id);
    if (!customerId) {
      return { ok: false, permanent: true, error: "MISSING_CUSTOMER_MAPPING" };
    }

    const { data: lineRows, error: linesError } = await admin
      .from("agreement_invoice_lines")
      .select(
        "product_key,description,quantity,unit_price,line_amount,vat_rate,vat_amount,tax_code_id",
      )
      .eq("invoice_id", invoiceId)
      .order("created_at");

    if (linesError) {
      return {
        ok: false,
        permanent: false,
        error: safeStr(linesError?.message) || "AGREEMENT_INVOICE_LINES_LOOKUP_FAILED",
      };
    }

    const lines = (Array.isArray(lineRows) ? lineRows : []) as InvoiceLineRow[];
    if (lines.length === 0) {
      return { ok: false, permanent: true, error: "AGREEMENT_INVOICE_LINES_EMPTY" };
    }

    let runAuthPromise: Promise<TripletexAuth> | null = null;
    const getAuth = async () => {
      if (!runAuthPromise) {
        runAuthPromise = resolveTripletexAuth({ providerId });
      }
      return runAuthPromise;
    };

    const auth = await getAuth();
    const requestWithAuth = { auth };

    const invoiceLines: Array<{
      productId: string;
      quantity: number;
      unit_price: number;
      product_name: string;
      tripletex_vat_code: string;
      currency: string;
    }> = [];

    for (const line of lines) {
      const tier = productKeyToTier(line.product_key);
      const taxCodeId = safeStr(line.tax_code_id) || "MVA_15";

      const product = await ensureProviderProduct({
        admin,
        providerId,
        tier,
        request: requestWithAuth,
      });

      const vat = await ensureProviderVatCode({
        admin,
        providerId,
        taxCodeId,
        request: requestWithAuth,
      });

      invoiceLines.push({
        productId: product.productId,
        quantity: Math.floor(safeNum(line.quantity)),
        unit_price: safeNum(line.unit_price),
        product_name: safeStr(line.description) || `${tier} måltid`,
        tripletex_vat_code: vat.vatCode,
        currency: "NOK",
      });
    }

    const periodStart = safeStr((invoice as any).invoice_period_start);
    const invoiceNumber = safeStr((invoice as any).invoice_number);

    let tripletexInvoiceId = "";

    try {
      const tripletexResult = await createInvoice({
        uniqueRef,
        customerId,
        invoiceLines,
        request: requestWithAuth,
      });
      tripletexInvoiceId = safeStr(tripletexResult.externalId);
    } catch (error: unknown) {
      const err = error instanceof TripletexClientError ? error : classifyTripletexError(error);
      if (err.status === 409) {
        tripletexInvoiceId = parseTripletexIdFromConflictDetail(err.detail);
        if (!tripletexInvoiceId) {
          return {
            ok: false,
            permanent: true,
            error: "TRIPLETEX_INVOICE_CONFLICT_UNRESOLVED",
          };
        }
      } else {
        throw error;
      }
    }

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

    const updateErr = await markInvoiceSent(admin, invoiceId, tripletexInvoiceId);
    if (updateErr) return updateErr;

    await writeTripletexSyncAudit(admin, invoiceId, {
      invoice_id: invoiceId,
      agreement_id: payload.agreementId || safeStr((invoice as any).agreement_id),
      provider_id: providerId,
      company_id: companyId,
      tripletex_invoice_id: tripletexInvoiceId,
      unique_ref: uniqueRef,
      period_start: periodStart,
      invoice_number: invoiceNumber,
      request_rid: payload.requestRid || null,
      event_key: row.event_key,
    });

    return { ok: true };
  } catch (error: unknown) {
    const classified = classifyHandlerError(error);
    return { ok: false, permanent: classified.permanent, error: classified.message };
  }
}
