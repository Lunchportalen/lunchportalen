import "server-only";

import { INTEGRATIONS } from "@/lib/integrations/config";
import { deterministicIntegrationId } from "@/lib/integrations/deterministicId";
import { classifyTripletexError, createInvoice } from "@/lib/integrations/tripletex/client";
import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type TripletexInvoicePayload = {
  amount?: unknown;
  description?: unknown;
  uniqueRef?: unknown;
  customerId?: unknown;
  productId?: unknown;
  tripletex_vat_code?: unknown;
};

export type CreateTripletexInvoiceResult = {
  ok: boolean;
  invoiceId?: string;
  skipped?: boolean;
  reason?: string;
  code?: string;
};

/**
 * Invoice-ready path via existing Tripletex client (POST /order → invoice). Never throws; always logs.
 * Requires TRIPLETEX_ENABLED=true plus full Tripletex env from client.ts and revenue default mapping envs below.
 */
export async function createTripletexInvoice(
  payload: TripletexInvoicePayload,
  ctx: { rid: string },
): Promise<CreateTripletexInvoiceResult> {
  if (!INTEGRATIONS.tripletex.enabled) {
    opsLog("tripletex_invoice_skipped", { rid: ctx.rid, reason: "TRIPLETEX_ENABLED_not_true" });
    return { ok: false, skipped: true, reason: "tripletex_disabled" };
  }

  const amount = safeNum(payload?.amount);
  if (amount <= 0) {
    opsLog("tripletex_invoice_skipped", { rid: ctx.rid, reason: "non_positive_amount" });
    return { ok: false, skipped: true, reason: "invalid_amount" };
  }

  const customerId = safeStr(payload?.customerId) || safeStr(process.env.TRIPLETEX_REVENUE_DEFAULT_CUSTOMER_ID);
  const productId = safeStr(payload?.productId) || safeStr(process.env.TRIPLETEX_REVENUE_DEFAULT_PRODUCT_ID);
  const vatCode =
    safeStr(payload?.tripletex_vat_code) || safeStr(process.env.TRIPLETEX_REVENUE_DEFAULT_VAT_CODE);

  if (!customerId || !productId || !vatCode) {
    opsLog("tripletex_invoice_skipped", {
      rid: ctx.rid,
      reason: "missing_revenue_invoice_mapping",
      hasCustomer: Boolean(customerId),
      hasProduct: Boolean(productId),
      hasVat: Boolean(vatCode),
    });
    return { ok: false, skipped: true, reason: "missing_tripletex_revenue_defaults" };
  }

  const desc = safeStr(payload?.description) || "revenue";
  const uniqueRef =
    safeStr(payload?.uniqueRef) ||
    deterministicIntegrationId("lp_rev", [ctx.rid, String(amount), desc, customerId, productId]);

  try {
    const { externalId } = await createInvoice({
      uniqueRef,
      customerId,
      productId,
      invoiceLine: {
        quantity: 1,
        unit_price: amount,
        product_name: desc,
        tripletex_vat_code: vatCode,
        currency: "NOK",
      },
    });

    opsLog("tripletex_invoice_created", {
      rid: ctx.rid,
      uniqueRef,
      invoiceId: externalId,
    });

    return { ok: true, invoiceId: externalId };
  } catch (e) {
    const tripletexErr = classifyTripletexError(e);
    opsLog("tripletex_invoice_error", {
      rid: ctx.rid,
      code: tripletexErr.code,
      kind: tripletexErr.kind,
      message: tripletexErr.message,
    });
    return {
      ok: false,
      reason: tripletexErr.message,
      code: tripletexErr.code,
    };
  }
}
