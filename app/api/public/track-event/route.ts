import { randomUUID } from "node:crypto";

import { buildAttributionRecord } from "@/lib/ai/attribution/attributionModel";
import { storeAttribution } from "@/lib/ai/attribution/storeAttribution";
import type { ExperimentEventType } from "@/lib/experiments/types";
import { trackEvent } from "@/lib/experiments/tracker";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function normalizeType(raw: string): ExperimentEventType | null {
  const t = raw.trim().toLowerCase();
  if (t === "impression") return "impression";
  if (t === "view") return "view";
  if (t === "click") return "click";
  if (t === "conversion") return "conversion";
  return null;
}

/**
 * Public experiment telemetry. Contract: { ok, rid, data } | { ok: false, rid, error, message, status }.
 * Body: { experimentId, variantId, type: impression|view|click|conversion, userId? }
 */
export async function POST(request: Request) {
  return withApiAiEntrypoint(request, "POST", async () => {
    const rid = makeRid("exp_pub");

    if (isLocalCmsRuntimeEnabled()) {
      return jsonOk(rid, { recorded: false, eventType: "local_runtime" }, 200);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
    }

    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const experimentId = typeof o?.experimentId === "string" ? o.experimentId.trim() : "";
    const variantId = typeof o?.variantId === "string" ? o.variantId.trim() : "";
    const typeRaw = typeof o?.type === "string" ? o.type : "";
    const userId =
      o?.userId === null || o?.userId === undefined
        ? null
        : typeof o.userId === "string"
          ? o.userId.trim()
          : "";

    if (!experimentId || !isUuid(experimentId)) {
      return jsonErr(rid, "experimentId (uuid) er påkrevd.", 422, "VALIDATION_ERROR");
    }
    if (!variantId) {
      return jsonErr(rid, "variantId er påkrevd.", 422, "VALIDATION_ERROR");
    }
    const eventType = normalizeType(typeRaw);
    if (!eventType) {
      return jsonErr(rid, "type må være impression, view, click eller conversion.", 422, "VALIDATION_ERROR");
    }
    if (userId !== null && userId !== "" && !isUuid(userId)) {
      return jsonErr(rid, "userId må være UUID når den er satt.", 422, "VALIDATION_ERROR");
    }

    let supabase;
    try {
      supabase = supabaseAdmin();
    } catch {
      return jsonErr(rid, "Tjenesten er ikke konfigurert.", 500, "MISCONFIGURED");
    }

    try {
      const { data: vrow, error: vErr } = await supabase
        .from("experiment_variants")
        .select("id")
        .eq("experiment_id", experimentId)
        .eq("variant_id", variantId)
        .maybeSingle();
      if (vErr) return jsonErr(rid, vErr.message, 500, "DB_ERROR");
      if (!vrow) return jsonErr(rid, "Ukjent variant for eksperimentet.", 404, "NOT_FOUND");

      const { data: exp } = await supabase.from("experiments").select("status").eq("id", experimentId).maybeSingle();
      if (!exp || (exp as { status: string }).status !== "running") {
        return jsonErr(rid, "Eksperimentet kjører ikke.", 409, "NOT_RUNNING");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Validering feilet";
      return jsonErr(rid, msg, 500, "SERVER_ERROR");
    }

    const sessionHeader = typeof request.headers.get("x-session-id") === "string" ? request.headers.get("x-session-id")!.trim() : "";
    const sessionId = sessionHeader.length > 0 ? sessionHeader : randomUUID();
    try {
      const { error: sessErr } = await supabase.from("experiment_sessions").upsert(
        {
          experiment_id: experimentId,
          variant_id: variantId,
          session_id: sessionId,
          company_id: null,
        },
        { onConflict: "experiment_id,session_id" },
      );
      if (sessErr) {
        opsLog("experiment_session_upsert_failed", { rid, experimentId, variantId, message: sessErr.message });
      }
    } catch (e) {
      opsLog("experiment_session_upsert_failed", {
        rid,
        experimentId,
        variantId,
        message: e instanceof Error ? e.message : String(e),
      });
    }

    const out = await trackEvent({
      experimentId,
      variantId,
      eventType,
      userId: userId === "" ? null : userId,
    });

    if (out.ok === false) return jsonErr(rid, out.error, 500, "TRACK_FAILED");

    try {
      const attribution = buildAttributionRecord({
        actionType: "experiment",
        source: "public_tracking",
        entityId: variantId,
        metrics: {
          impressions: eventType === "impression" || eventType === "view" ? 1 : 0,
          clicks: eventType === "click" ? 1 : 0,
          conversions: eventType === "conversion" ? 1 : 0,
        },
      });
      await storeAttribution(attribution, rid);
      opsLog("attribution_track_event_sidecar", {
        rid,
        experimentId,
        variantId,
        eventType,
        actionType: attribution.actionType,
      });
    } catch (e) {
      opsLog("attribution_track_event_sidecar_failed", {
        rid,
        experimentId,
        variantId,
        eventType,
        message: e instanceof Error ? e.message : String(e),
      });
    }

    return jsonOk(rid, { recorded: true, eventType }, 200);
  });
}
