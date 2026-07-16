// FASE 8 — e-postlevering (provider_admin): ISSUED → SENT via idempotent outbox.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { requireProviderForInvoices } from "@/lib/billing/providerInvoiceGuard";
import { sendInvoiceEmail } from "@/lib/billing/invoiceLifecycle";

type Ctx = { params: { invoiceId: string } | Promise<{ invoiceId: string }> };

function appBaseUrl(req: NextRequest) {
  const env = String(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (env) return env.startsWith("http") ? env : `https://${env}`;
  return new URL(req.url).origin;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const rid = makeRid("prov_inv_send");
  const params = await Promise.resolve(ctx.params as any);
  const invoiceId = String(params?.invoiceId ?? "").trim();

  const g = await requireProviderForInvoices({ minRole: "provider_admin", invoiceId });
  if (g.ok === false) return jsonErr(rid, g.message, g.status, g.code);

  const res = await sendInvoiceEmail({ invoiceId, actor: g.userId, baseUrl: appBaseUrl(req) });
  if (res.ok === false) {
    if (res.code === "BILLING_EMAIL_MISSING") {
      return jsonErr(rid, "Firmaet mangler fakturamottaker (e-post). Be firmaet fylle ut fakturaprofilen.", 422, res.code);
    }
    if (res.code === "INVOICE_NOT_ISSUED") return jsonErr(rid, "Fakturaen må utstedes før sending.", 409, res.code);
    return jsonErr(rid, "Kunne ikke sende fakturaen.", 500, res.code);
  }
  return jsonOk(rid, { recipient: res.recipient, status: "SENT" }, 200);
}
