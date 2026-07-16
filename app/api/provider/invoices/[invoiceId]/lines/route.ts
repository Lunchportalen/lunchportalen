// FASE 8 — manuelle linjer (provider_admin): tillegg/rabatt/korrigering på DRAFT.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { requireProviderForInvoices } from "@/lib/billing/providerInvoiceGuard";
import { invoiceRpc } from "@/lib/billing/invoiceLifecycle";

type Ctx = { params: { invoiceId: string } | Promise<{ invoiceId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const rid = makeRid("prov_inv_line");
  const params = await Promise.resolve(ctx.params as any);
  const invoiceId = String(params?.invoiceId ?? "").trim();

  const g = await requireProviderForInvoices({ minRole: "provider_admin", invoiceId });
  if (g.ok === false) return jsonErr(rid, g.message, g.status, g.code);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const source = String(body?.source ?? "").trim().toUpperCase();
  const description = String(body?.description ?? "").trim();
  const quantity = Number(body?.quantity ?? 1);
  const unitPrice = Number(body?.unit_price);
  const vatRate = Number(body?.vat_rate ?? 0);
  if (!["ADDITION", "DISCOUNT", "CORRECTION", "CANCELLATION_CORRECTION"].includes(source)) {
    return jsonErr(rid, "Ugyldig linjetype.", 422, "LINE_SOURCE_INVALID");
  }
  if (!description) return jsonErr(rid, "Beskrivelse er påkrevd.", 422, "DESCRIPTION_REQUIRED");
  if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity) || quantity === 0) {
    return jsonErr(rid, "Ugyldige linjeverdier.", 422, "LINE_VALUES_INVALID");
  }

  const res = await invoiceRpc.addLine({
    invoiceId,
    source,
    description,
    quantity: Math.trunc(quantity),
    unitPrice,
    vatRate: Number.isFinite(vatRate) ? vatRate : 0,
    actor: g.userId,
    orderId: String(body?.order_id ?? "").trim() || null,
    serviceDate: String(body?.service_date ?? "").trim() || null,
  });
  if (res.ok === false) {
    if (res.code === "INVOICE_NOT_DRAFT") return jsonErr(rid, "Linjer kan kun endres på utkast.", 409, res.code);
    if (res.code === "ADDITION_MUST_BE_POSITIVE") return jsonErr(rid, "Tillegg må være positivt.", 422, res.code);
    return jsonErr(rid, "Kunne ikke legge til linjen.", 500, res.code);
  }
  return jsonOk(rid, res.data, 200);
}
