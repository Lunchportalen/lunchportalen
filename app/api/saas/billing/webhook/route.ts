// app/api/saas/billing/webhook/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { handleStripeWebhook } from "@/lib/saas/billing";

export async function POST(req: NextRequest) {
  const rid = makeRid("wh");
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  const result = await handleStripeWebhook(raw, sig);
  if (result.ok === false) {
    const status = result.code === "INVALID_SIGNATURE" ? 400 : 500;
    return jsonErr(rid, result.message, status, result.code ?? "WEBHOOK_ERROR");
  }
  return jsonOk(rid, { received: true });
}
