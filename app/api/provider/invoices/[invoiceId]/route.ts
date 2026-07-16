// FASE 8 — provider-faktura detalj (viewer, kun egen provider).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { requireProviderForInvoices } from "@/lib/billing/providerInvoiceGuard";
import { loadInvoiceWithLines } from "@/lib/billing/invoiceLifecycle";

type Ctx = { params: { invoiceId: string } | Promise<{ invoiceId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const rid = makeRid("prov_inv_get");
  const params = await Promise.resolve(ctx.params as any);
  const invoiceId = String(params?.invoiceId ?? "").trim();

  const g = await requireProviderForInvoices({ minRole: "provider_viewer", invoiceId });
  if (g.ok === false) return jsonErr(rid, g.message, g.status, g.code);

  const bundle = await loadInvoiceWithLines(invoiceId);
  if (!bundle) return jsonErr(rid, "Fakturaen finnes ikke.", 404, "INVOICE_NOT_FOUND");
  return jsonOk(rid, bundle, 200);
}
