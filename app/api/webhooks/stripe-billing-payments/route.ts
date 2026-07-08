export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { handleProviderStripePaymentWebhook } from "@/lib/billing/stripePaymentWebhook";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function POST(req: NextRequest) {
  const rid = makeRid("wh_stripe_pay");
  const signature = req.headers.get("stripe-signature");
  const raw = await req.text();

  const result = await handleProviderStripePaymentWebhook(raw, signature);
  if (!result.ok) {
    const status = result.code === "INVALID_SIGNATURE" ? 400 : 500;
    return jsonErr(rid, result.message, status, result.code);
  }

  return jsonOk(rid, {
    received: true,
    duplicate: result.duplicate === true,
    ignored: result.ignored === true,
    unmatched: result.unmatched === true,
  });
}
