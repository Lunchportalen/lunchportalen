import { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";

const RATE_LIMIT_PER_MINUTE = 60;

const rateLimitMap = new Map<string, number>();

function getMinuteBucket(): number {
  return Math.floor(Date.now() / 60_000);
}

function pruneOldBuckets(currentMinute: number): void {
  for (const [key, _] of rateLimitMap) {
    const parts = key.split(":");
    const bucket = parseInt(parts[parts.length - 1], 10);
    if (bucket < currentMinute - 1) rateLimitMap.delete(key);
  }
}

const ENVIRONMENTS = ["prod", "staging"] as const;
const LOCALES = ["nb", "en"] as const;
/** Keep in sync with lib/analytics/events.ts REVENUE_EVENT_TYPES where overlapping. */
const EVENT_TYPES = [
  "page_view",
  "search",
  "cta_click",
  "scroll_depth",
  "form_submit",
  "conversion",
] as const;

export async function POST(request: NextRequest) {
  const rid = makeRid("ana");
  try {
    if (isLocalCmsRuntimeEnabled()) {
      return jsonOk(rid, { ok: true, rid, localRuntime: true, recorded: false }, 200);
    }
    if (request.method !== "POST") {
      return jsonErr(rid, "Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErr(rid, "Invalid JSON body", 400, "INVALID_JSON");
    }

    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    if (!o) {
      return jsonErr(rid, "Body must be an object", 400, "INVALID_BODY");
    }

    const environment = o.environment;
    const locale = o.locale;
    const eventType = o.eventType;
    if (
      typeof environment !== "string" ||
      !ENVIRONMENTS.includes(environment as (typeof ENVIRONMENTS)[number])
    ) {
      return jsonErr(rid, "environment must be prod or staging", 400, "INVALID_ENVIRONMENT");
    }
    if (typeof locale !== "string" || !LOCALES.includes(locale as (typeof LOCALES)[number])) {
      return jsonErr(rid, "locale must be nb or en", 400, "INVALID_LOCALE");
    }
    if (
      typeof eventType !== "string" ||
      !EVENT_TYPES.includes(eventType as (typeof EVENT_TYPES)[number])
    ) {
      return jsonErr(
        rid,
        "eventType must be page_view, search, cta_click, scroll_depth, form_submit, or conversion",
        400,
        "INVALID_EVENT_TYPE",
      );
    }

    const pageId = (o.pageId ?? o.page_id) != null ? String(o.pageId ?? o.page_id) : "";
    const variantId = (o.variantId ?? o.variant_id) != null ? String(o.variantId ?? o.variant_id) : "";
    const eventKey = (o.eventKey ?? o.event_key) != null ? String(o.eventKey ?? o.event_key) : "";
    const eventValue = (o.eventValue ?? o.event_value) != null ? String(o.eventValue ?? o.event_value) : null;
    const metadataRaw = o.metadata;

    if (eventValue !== null && eventValue.length > 80) {
      return jsonErr(rid, "event_value max 80 chars", 400, "EVENT_VALUE_TOO_LONG");
    }
    if (eventKey.length > 64) {
      return jsonErr(rid, "event_key max 64 chars", 400, "EVENT_KEY_TOO_LONG");
    }

    let metadata: Record<string, unknown> = {};
    if (metadataRaw != null) {
      if (typeof metadataRaw !== "object" || Array.isArray(metadataRaw)) {
        return jsonErr(rid, "metadata must be an object", 400, "INVALID_METADATA");
      }
      metadata = metadataRaw as Record<string, unknown>;
    }
    const metadataStr = JSON.stringify(metadata);
    if (metadataStr.length > 1000) {
      return jsonErr(rid, "metadata JSON stringify max 1000", 400, "METADATA_TOO_LONG");
    }

    const minuteBucket = getMinuteBucket();
    pruneOldBuckets(minuteBucket);
    const rateKey = `${eventType}:${environment}:${locale}:${pageId}:${variantId}:${eventKey}:${minuteBucket}`;
    const count = (rateLimitMap.get(rateKey) ?? 0) + 1;
    rateLimitMap.set(rateKey, count);
    if (count > RATE_LIMIT_PER_MINUTE) {
      return jsonErr(rid, "Too many requests", 429, "RATE_LIMIT_EXCEEDED");
    }

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();

    const { error: insertError } = await supabase.from("content_analytics_events").insert({
      page_id: pageId || null,
      variant_id: variantId || null,
      environment,
      locale,
      event_type: eventType,
      event_key: eventKey || null,
      event_value: eventValue,
      metadata: metadataStr.length ? (JSON.parse(metadataStr) as object) : {},
    });

    if (insertError) {
      return jsonErr(rid, insertError.message, 500, "INSERT_FAILED");
    }

    // POS: kun «signifikante» vekstsignaler (unngå støy fra hver eneste page_view).
    const isDemoFunnel =
      typeof metadata.funnel === "string" && metadata.funnel.trim().toLowerCase() === "ai_demo";
    const significantForPos = eventType === "cta_click" || (isDemoFunnel && eventType === "search");
    if (significantForPos) {
      try {
        const { onEvent } = await import("@/lib/pos/eventHandler");
        onEvent({
          type: "variant_performance_updated",
          analytics_event_type: eventType as (typeof EVENT_TYPES)[number],
          page_id: pageId || null,
          variant_id_analytics: variantId || null,
        });
      } catch {
        /* POS er best-effort etter vellykket insert */
      }
    }

    return jsonOk(rid, { ok: true, rid }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonErr(rid, message, 500, "SERVER_ERROR");
  }
}
