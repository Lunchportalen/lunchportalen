// FASE 8 — VOID (provider_admin): kontrollert annullering før betaling;
// frigjør ordrene for reissue etter korrigering.
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
  const rid = makeRid("prov_inv_void");
  const params = await Promise.resolve(ctx.params as any);
  const invoiceId = String(params?.invoiceId ?? "").trim();

  const g = await requireProviderForInvoices({ minRole: "provider_admin", invoiceId });
  if (g.ok === false) return jsonErr(rid, g.message, g.status, g.code);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = String(body?.reason ?? "").trim();
  if (reason.length < 3) return jsonErr(rid, "Begrunnelse er påkrevd.", 422, "REASON_REQUIRED");

  const res = await invoiceRpc.void({ invoiceId, reason, actor: g.userId });
  if (res.ok === false) {
    if (res.code === "INVOICE_NOT_VOIDABLE") return jsonErr(rid, "Fakturaen kan ikke annulleres (utstedt med betaling, eller feil status).", 409, res.code);
    return jsonErr(rid, "Kunne ikke annullere fakturaen.", 500, res.code);
  }
  return jsonOk(rid, res.data, 200);
}
