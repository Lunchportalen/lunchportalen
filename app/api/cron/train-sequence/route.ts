export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { rid } from "@/lib/http/rid";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { SEQUENCE_DEFAULT_WINDOW } from "@/lib/ml/sequenceConstants";
import { executeSequenceTrainingPipeline } from "@/lib/ml/sequenceTrainPipeline";
import { opsLog } from "@/lib/ops/log";

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = rid("ml_seq_train");

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

    if (!isSystemEnabled()) {
      opsLog("sequence_train_skipped", { rid: requestId, reason: "kill_switch" });
      return jsonOk(requestId, { trained: false, skipped: true, reason: "kill_switch" }, 200);
    }

    const url = new URL(req.url);
    const w = Number(url.searchParams.get("window"));
    const windowSize = Number.isFinite(w) && w >= 2 && w <= 30 ? Math.floor(w) : SEQUENCE_DEFAULT_WINDOW;

    const result = await executeSequenceTrainingPipeline(requestId, windowSize);
    return jsonOk(requestId, { trained: result.trained, ...result }, 200);
  });
}
