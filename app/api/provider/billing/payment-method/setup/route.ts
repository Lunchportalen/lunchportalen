export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { createProviderPaymentSetupSession } from "@/lib/billing/stripeProviderSetup";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

export async function POST(req: NextRequest) {
  const rid = makeRid("stripe_setup");
  const auth = await getAuthContext({ rid, reqHeaders: req.headers });

  if (!auth.ok || !auth.user?.id) {
    return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }

  const providerId = safeStr(body.providerId ?? body.provider_id);
  if (!providerId) {
    return jsonErr(rid, "Provider mangler.", 422, "PROVIDER_ID_REQUIRED");
  }

  const allowed = await hasProviderRole(auth.user.id, providerId, "provider_admin");
  if (!allowed) {
    return jsonErr(rid, "Ingen tilgang til betalingsoppsett for denne leverandøren.", 403, "PROVIDER_FORBIDDEN");
  }

  const result = await createProviderPaymentSetupSession({
    providerId,
    actorUserId: auth.user.id,
    actorEmail: auth.user.email,
    successPath: safeStr(body.successPath) || null,
    cancelPath: safeStr(body.cancelPath) || null,
  });

  if (result.ok === false) {
    const status = result.code === "BILLING_PROFILE_NOT_FOUND" ? 409 : result.code === "STRIPE_NOT_CONFIGURED" ? 503 : 502;
    return jsonErr(rid, result.message, status, result.code);
  }

  return jsonOk(rid, {
    providerId,
    provider: "stripe",
    mode: "setup",
    url: result.url,
    sessionId: result.sessionId,
    customerId: result.customerId,
    chargeCreated: false,
  });
}
