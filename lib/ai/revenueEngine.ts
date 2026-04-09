import "server-only";

import { buildAttributionRecord } from "@/lib/ai/attribution/attributionModel";
import { storeAttribution } from "@/lib/ai/attribution/storeAttribution";
import { createTripletexInvoice } from "@/lib/integrations/tripletexEngine";
import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type RecordRevenueResult = {
  ok: boolean;
  skipped?: boolean;
  invoiceId?: string;
  reason?: string;
  code?: string;
};

/**
 * Revenue → Tripletex invoice path (gated). All outcomes logged; never throws.
 */
export async function recordRevenue(event: unknown, ctx: { rid: string }): Promise<RecordRevenueResult> {
  const amount = safeNum((event as { amount?: unknown })?.amount);
  if (amount <= 0) {
    opsLog("revenue_skipped", { rid: ctx.rid, reason: "non_positive_amount" });
    return { ok: false, skipped: true, reason: "non_positive_amount" };
  }

  const description = safeStr((event as { type?: unknown })?.type) || "REVENUE_EVENT";
  const invoice = await createTripletexInvoice(
    {
      amount,
      description,
      uniqueRef: (event as { uniqueRef?: unknown })?.uniqueRef,
      customerId: (event as { customerId?: unknown })?.customerId,
      productId: (event as { productId?: unknown })?.productId,
      tripletex_vat_code: (event as { tripletex_vat_code?: unknown })?.tripletex_vat_code,
    },
    ctx,
  );

  opsLog("revenue_recorded", {
    rid: ctx.rid,
    amount,
    ok: invoice.ok,
    invoiceId: invoice.invoiceId,
    skipped: invoice.skipped,
    reason: invoice.reason,
    code: invoice.code,
  });

  if (invoice.ok === true && amount > 0) {
    const attribution = buildAttributionRecord({
      actionType: "revenue",
      source: "tripletex",
      entityId: invoice.invoiceId ?? null,
      metrics: {
        revenue: amount,
        conversions: 1,
      },
    });
    await storeAttribution(attribution, ctx.rid);
    opsLog("attribution_revenue_sidecar", {
      rid: ctx.rid,
      invoiceId: invoice.invoiceId ?? null,
      amount,
    });
  }

  return {
    ok: invoice.ok,
    skipped: invoice.skipped,
    invoiceId: invoice.invoiceId,
    reason: invoice.reason,
    code: invoice.code,
  };
}
