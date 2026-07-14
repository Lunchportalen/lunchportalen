// FASE 8 — finalize/issue (provider_admin): DRAFT → ISSUED med sekvensielt nummer.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { requireProviderForInvoices } from "@/lib/billing/providerInvoiceGuard";
import { invoiceRpc } from "@/lib/billing/invoiceLifecycle";

type Ctx = { params: { invoiceId: string } | Promise<{ invoiceId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const rid = makeRid("prov_inv_finalize");
  const params = await Promise.resolve(ctx.params as any);
  const invoiceId = String(params?.invoiceId ?? "").trim();

  const g = await requireProviderForInvoices({ minRole: "provider_admin", invoiceId });
  if (g.ok === false) return jsonErr(rid, g.message, g.status, g.code);

  const res = await invoiceRpc.finalize({ invoiceId, actor: g.userId });
  if (res.ok === false) {
    if (res.code === "INVOICE_NOT_DRAFT") return jsonErr(rid, "Fakturaen er allerede utstedt.", 409, res.code);
    if (res.code === "INVOICE_HAS_NO_LINES") return jsonErr(rid, "Fakturaen har ingen linjer.", 422, res.code);
    return jsonErr(rid, "Kunne ikke utstede fakturaen.", 500, res.code);
  }
  return jsonOk(rid, res.data, 200);
}
