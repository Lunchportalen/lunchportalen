/**
 * Manual / operator trigger for integration stubs (cron-secret gated). No public unauthenticated execution.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { recordRevenue } from "@/lib/ai/revenueEngine";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { launchAdCampaign } from "@/lib/integrations/adsEngine";
import { createLead } from "@/lib/integrations/crmEngine";
import { sendEmailSequence } from "@/lib/integrations/emailEngine";
import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = makeRid("integrations_execute");

    try {
      requireCronAuth(req, { secretEnvVar: "SYSTEM_MOTOR_SECRET", missingCode: "system_motor_secret_missing" });
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? e);
      const code = String((e as { code?: unknown })?.code ?? "").trim();
      if (msg === "system_motor_secret_missing" || code === "system_motor_secret_missing") {
        return jsonErr(requestId, "SYSTEM_MOTOR_SECRET er ikke satt.", 500, "MISCONFIGURED");
      }
      if (msg === "forbidden" || code === "forbidden") {
        return jsonErr(requestId, "Ugyldig cron-secret.", 403, "FORBIDDEN");
      }
      return jsonErr(requestId, "Cron-gate feilet.", 500, "CRON_AUTH_ERROR");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(requestId, "Ugyldig JSON.", 400, "INVALID_JSON");
    }

    const t = safeStr((body as { type?: unknown })?.type).toLowerCase();
    if (!t) {
      return jsonErr(requestId, "Mangler type.", 422, "VALIDATION_ERROR");
    }

    opsLog("integrations_execute_request", { rid: requestId, type: t });

    try {
      switch (t) {
        case "ads": {
          const out = await launchAdCampaign(body, { rid: requestId });
          return jsonOk(requestId, { executed: true, type: t, result: out }, 200);
        }
        case "email": {
          const out = await sendEmailSequence(body, { rid: requestId });
          return jsonOk(requestId, { executed: true, type: t, result: out }, 200);
        }
        case "revenue": {
          const out = await recordRevenue(body, { rid: requestId });
          return jsonOk(requestId, { executed: true, type: t, result: out }, 200);
        }
        case "crm": {
          const data = (body as { data?: unknown }).data ?? body;
          const out = await createLead(data, { rid: requestId });
          return jsonOk(requestId, { executed: true, type: t, result: out }, 200);
        }
        default:
          return jsonErr(requestId, "Ukjent type.", 422, "INVALID_TYPE");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("integrations_execute_error", { rid: requestId, type: t, message });
      return jsonErr(requestId, message, 500, "EXECUTION_FAILED");
    }
  });
}
