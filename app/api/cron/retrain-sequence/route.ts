export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { rid } from "@/lib/http/rid";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { resolveCronBaseUrl } from "@/lib/ml/cronBaseUrl";
import { computeSequenceDrift } from "@/lib/ml/retrainSequenceDrift";
import { executeSequenceTrainingPipeline } from "@/lib/ml/sequenceTrainPipeline";
import { SEQUENCE_DEFAULT_WINDOW } from "@/lib/ml/sequenceConstants";
import { opsLog } from "@/lib/ops/log";

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = rid("ml_seq_retrain");

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
      opsLog("sequence_retrain_skipped", { rid: requestId, reason: "kill_switch" });
      return jsonOk(requestId, { drift: false, retrained: false, skipped: true, reason: "kill_switch" }, 200);
    }

    const { drift, errors } = await computeSequenceDrift();
    opsLog("sequence_retrain_eval", { rid: requestId, drift, errorSamples: errors.length });

    if (!drift) {
      return jsonOk(requestId, { drift: false, retrained: false }, 200);
    }

    if (safeTrim(process.env.ML_SEQUENCE_DRIFT_RETRAIN_DISABLED) === "true") {
      opsLog("sequence_retrain_skipped", { rid: requestId, reason: "ML_SEQUENCE_DRIFT_RETRAIN_DISABLED" });
      return jsonOk(requestId, { drift: true, retrained: false, reason: "retrain_disabled" }, 200);
    }

    const base = resolveCronBaseUrl();
    const secret = safeTrim(process.env.SYSTEM_MOTOR_SECRET);
    let retrained = false;

    const urlObj = new URL(req.url);
    const w = Number(urlObj.searchParams.get("window"));
    const windowSize = Number.isFinite(w) && w >= 2 && w <= 30 ? Math.floor(w) : SEQUENCE_DEFAULT_WINDOW;

    if (base && secret) {
      try {
        const url = `${base}/api/cron/train-sequence?window=${windowSize}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}` },
          cache: "no-store",
        });
        let httpTrained = false;
        if (res.ok) {
          const body = (await res.json().catch(() => null)) as { data?: { trained?: boolean } } | null;
          httpTrained = Boolean(body?.data?.trained);
        }
        retrained = httpTrained;
        opsLog("sequence_retrain_called_train_sequence", {
          rid: requestId,
          httpOk: res.ok,
          httpStatus: res.status,
          trained: httpTrained,
          url,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        opsLog("sequence_retrain_train_fetch_failed", { rid: requestId, message });
      }
    } else {
      opsLog("sequence_retrain_no_http_target", { rid: requestId, hasBase: Boolean(base), hasSecret: Boolean(secret) });
    }

    if (!retrained) {
      const pipeline = await executeSequenceTrainingPipeline(requestId, windowSize);
      retrained = pipeline.trained;
      opsLog("sequence_retrain_inline_pipeline", { rid: requestId, trained: pipeline.trained, reason: pipeline.reason });
    }

    return jsonOk(requestId, { drift: true, retrained }, 200);
  });
}
