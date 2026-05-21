export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { POST as processTripletexOutbox } from "@/app/api/system/outbox/process/route";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

/**
 * CRON_SECRET-gated entry for Tripletex outbox worker
 * (invoice.ready, provider_customer_create_lp, saas_invoice_create_lp).
 * SMTP outbox cron releases Tripletex keys back to PENDING; this route processes them.
 */
export async function POST(req: NextRequest) {
  const rid = makeRid("cron_ttx_ob");

  try {
    requireCronAuth(req);
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    const code = String((e as { code?: string })?.code ?? "").trim();

    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i env", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron secret", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate", 500, {
      code: "server_error",
      detail: { message: msg },
    });
  }

  const inner = await processTripletexOutbox(req);
  if (inner.status >= 400) {
    return inner;
  }

  let payload: unknown = null;
  try {
    const parsed = await inner.clone().json();
    payload = parsed?.data ?? parsed;
  } catch {
    payload = null;
  }

  return jsonOk(rid, payload ?? {}, inner.status);
}
