export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { handleProviderStripeSetupWebhook } from "@/lib/billing/stripeProviderSetup";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { opsKillSwitchResponse } from "@/lib/system/opsKillSwitch";

export async function POST(req: NextRequest) {
  const rid = makeRid("wh_stripe_setup");

  // Fase I kill switch: 503 (retryable) — Stripe redeliverer events etter reaktivering.
  const killed = await opsKillSwitchResponse(rid, "stripe_webhooks", "stripe_setup");
  if (killed) return killed;

  const signature = req.headers.get("stripe-signature");
  const raw = await req.text();

  const result = await handleProviderStripeSetupWebhook(raw, signature);
  if (result.ok === false) {
    const status = result.code === "INVALID_SIGNATURE" ? 400 : 500;
    return jsonErr(rid, result.message, status, result.code);
  }

  return jsonOk(rid, {
    received: true,
    duplicate: result.duplicate === true,
    ignored: result.ignored === true,
  });
}
