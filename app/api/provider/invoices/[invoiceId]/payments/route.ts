// FASE 8 — manuell bankbetaling (provider_admin), idempotent import-grense.
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
  const rid = makeRid("prov_inv_payment");
  const params = await Promise.resolve(ctx.params as any);
  const invoiceId = String(params?.invoiceId ?? "").trim();

  const g = await requireProviderForInvoices({ minRole: "provider_admin", invoiceId });
  if (g.ok === false) return jsonErr(rid, g.message, g.status, g.code);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const amount = Number(body?.amount);
  const idempotencyKey = String(body?.idempotency_key ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0) return jsonErr(rid, "Beløp må være større enn 0.", 422, "PAYMENT_AMOUNT_INVALID");
  if (idempotencyKey.length < 8) return jsonErr(rid, "idempotency_key (min. 8 tegn) er påkrevd.", 422, "IDEMPOTENCY_KEY_REQUIRED");

  const res = await invoiceRpc.registerPayment({
    invoiceId,
    amount,
    paidAt: String(body?.paid_at ?? "").trim() || null,
    method: String(body?.method ?? "BANK").trim(),
    reference: String(body?.reference ?? "").trim() || null,
    idempotencyKey,
    actor: g.userId,
  });
  if (res.ok === false) {
    if (res.code === "INVOICE_NOT_PAYABLE") return jsonErr(rid, "Fakturaen kan ikke betales i nåværende status.", 409, res.code);
    return jsonErr(rid, "Kunne ikke registrere betalingen.", 500, res.code);
  }
  return jsonOk(rid, res.data, 200);
}
