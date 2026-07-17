/**
 * Phase 16NO.4 — daily Norway MVA threshold + Brreg registration poll.
 * Durable, idempotent. Does not submit registration applications.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireCronAuth } from "@/lib/http/cronAuth";
import { captureCronHandlerError } from "@/lib/http/cronObservability";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  buildNorwayMvaDashboard,
  emitThresholdWarningsIfNeeded,
  ensureCrossingHolds,
  isNorwayMvaControllerEnabled,
  recordBrregCheckAndMaybeActivate,
} from "@/lib/markets/norwayMvaController";

export async function POST(req: Request) {
  const rid = makeRid();
  try {
    requireCronAuth(req);

    const enabled = await isNorwayMvaControllerEnabled();
    if (!enabled) {
      return jsonOk(rid, {
        controller: "INACTIVE",
        note: "norway_mva_threshold_config.controller_enabled=false",
      });
    }

    const dashBefore = await buildNorwayMvaDashboard();
    const holds = await ensureCrossingHolds("system:cron:norway-mva-threshold");
    const warnings = await emitThresholdWarningsIfNeeded("system:cron:norway-mva-threshold");

    // Poll Brreg daily when registration pending / crossed, or always lightly for status drift.
    const shouldPoll =
      dashBefore.status === "CROSSING_EVENT_DETECTED" ||
      dashBefore.status === "REGISTRATION_REQUIRED" ||
      dashBefore.status === "REGISTRATION_PENDING" ||
      holds.crossingEventId != null ||
      dashBefore.mvaRegistered === false;

    let brreg: Awaited<ReturnType<typeof recordBrregCheckAndMaybeActivate>> | null = null;
    if (shouldPoll) {
      // Never auto-activate VAT in production canary without verified registration;
      // activateVatOnRegister applies only when Brreg returns true.
      brreg = await recordBrregCheckAndMaybeActivate({
        actor: "system:cron:norway-mva-threshold",
        activateVatOnRegister: true,
      });
    }

    const dashAfter = await buildNorwayMvaDashboard();

    return jsonOk(rid, {
      controller: "ACTIVE",
      before: {
        status: dashBefore.status,
        recognized: dashBefore.recognizedTaxableTurnoverMinor,
        band: dashBefore.warningBand,
      },
      holds,
      warnings,
      brreg: brreg
        ? {
            ok: brreg.check.ok,
            registered: brreg.check.registeredInMvaRegister,
            statusChanged: brreg.statusChanged,
            vatActivated: brreg.vatActivated,
            errorCode: brreg.check.errorCode,
          }
        : null,
      after: {
        status: dashAfter.status,
        recognized: dashAfter.recognizedTaxableTurnoverMinor,
        invoiceTransmission: dashAfter.invoiceTransmission,
        checksum: dashAfter.calculationChecksum,
      },
    });
  } catch (e) {
    captureCronHandlerError("/api/cron/norway-mva-threshold", rid, e);
    return jsonErr(rid, "NORWAY_MVA_THRESHOLD_CRON_FAILED", 500, "internal");
  }
}

export async function GET(req: Request) {
  return POST(req);
}
