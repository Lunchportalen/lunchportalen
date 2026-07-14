// FASE 8 — kreditnota (provider_admin): full/partiell, kansellerings- og
// kryssperiode-korrigering via ordre-subset.
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
  const rid = makeRid("prov_inv_credit");
  const params = await Promise.resolve(ctx.params as any);
  const invoiceId = String(params?.invoiceId ?? "").trim();

  const g = await requireProviderForInvoices({ minRole: "provider_admin", invoiceId });
  if (g.ok === false) return jsonErr(rid, g.message, g.status, g.code);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = String(body?.reason ?? "").trim();
  if (reason.length < 3) return jsonErr(rid, "Begrunnelse er påkrevd.", 422, "REASON_REQUIRED");
  const orderIdsRaw = Array.isArray(body?.order_ids) ? (body?.order_ids as unknown[]) : null;
  const orderIds = orderIdsRaw
    ? orderIdsRaw.map((v) => String(v ?? "").trim()).filter((v) => /^[0-9a-f-]{36}$/i.test(v))
    : null;

  const res = await invoiceRpc.createCreditNote({ invoiceId, reason, actor: g.userId, orderIds });
  if (res.ok === false) {
    if (res.code === "INVOICE_NOT_CREDITABLE") return jsonErr(rid, "Fakturaen kan ikke krediteres i nåværende status.", 409, res.code);
    if (res.code === "NO_LINES_TO_CREDIT") return jsonErr(rid, "Ingen linjer å kreditere for valget.", 422, res.code);
    return jsonErr(rid, "Kunne ikke opprette kreditnota.", 500, res.code);
  }
  return jsonOk(rid, res.data, 200);
}
