export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { chargeProviderCommissionInvoice } from "@/lib/billing/stripeProviderCharge";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(req: NextRequest) {
  const auth = await scopeOr401(req);
  if (!auth.ok) return auth.response ?? auth.res;

  const deny = requireRoleOr403(auth.ctx, "api.superadmin.billing.stripe-charge.POST", ["superadmin"]);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const providerInvoiceId = safeStr(body.providerInvoiceId ?? body.provider_invoice_id);
  const idempotencyKey = safeStr(body.idempotencyKey ?? body.idempotency_key) || null;

  if (!providerInvoiceId) {
    return jsonErr(auth.ctx.rid, "providerInvoiceId er påkrevd.", 422, "PROVIDER_INVOICE_ID_REQUIRED");
  }

  const result = await chargeProviderCommissionInvoice({
    providerInvoiceId,
    idempotencyKey,
    actorUserId: auth.ctx.scope.userId,
  });

  if (!result.ok) {
    return jsonErr(auth.ctx.rid, result.message, 409, result.code, {
      missingRequirements: result.missingRequirements ?? [],
    });
  }

  return jsonOk(auth.ctx.rid, result);
}
