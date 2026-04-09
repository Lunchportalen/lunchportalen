/**
 * Editor-AI metrics ingest (trinn 2).
 * POST: accept editor-AI event, validate, write to ai_activity_log.
 * Auth: scopeOr401 then requireRoleOr403(superadmin | company_admin). Fails closed (401/403).
 * CRO events (cro_analysis, cro_apply, cro_dismiss) use this same gate; no separate CRO route.
 * Observability: ai_error, media_error, builder_warning, content_error are accepted and stored.
 * On insert failure returns 500 METRICS_INSERT_FAILED; client does not retry (best-effort).
 */

import { NextRequest } from "next/server";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import {
  isContentBackendUnavailableError,
  isLocalDevContentReserveEnabled,
} from "@/lib/cms/contentLocalDevReserve";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

const VALID_TYPES = [
  "editor_opened",
  "ai_action_triggered",
  "ai_result_received",
  "ai_patch_applied",
  "ai_save_after_action",
] as const;

const OBSERVABILITY_TYPES = ["ai_error", "media_error", "builder_warning", "content_error"] as const;

const VALID_FEATURES = [
  "improve_page",
  "seo_optimize",
  "seo_intelligence",
  "seo_recommendation",
  "generate_sections",
  "structured_intent",
  "seo_inline",
  "hero_inline",
  "cta_inline",
  "page_builder",
  "block_builder",
  "screenshot_builder",
  "layout_suggestions",
  "visual_options",
  "image_metadata",
  "image_generate",
  "image_suggestions",
  "cro_analysis",
  "cro_apply",
  "cro_dismiss",
  "page_intelligence",
] as const;

const MAX_BODY_KEYS = 24;

function safeStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function parseBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { type: "", timestamp: null, pageId: null, variantId: null, feature: null, patchPresent: null, message: null, kind: null, count: null };
  }
  const o = body as Record<string, unknown>;
  return {
    type: typeof o.type === "string" ? o.type : "",
    timestamp: safeStr(o.timestamp),
    pageId: safeStr(o.pageId),
    variantId: safeStr(o.variantId),
    feature: safeStr(o.feature),
    patchPresent: typeof o.patchPresent === "boolean" ? o.patchPresent : null,
    message: safeStr(o.message),
    kind: safeStr(o.kind),
    count: typeof o.count === "number" && Number.isFinite(o.count) ? o.count : null,
  };
}

export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin", "company_admin"]);
  if (deny) return deny;

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return jsonErr(ctx.rid, "Body må være et objekt.", 400, "invalid_body");
  }
  if (Object.keys(raw).length > MAX_BODY_KEYS) {
    return jsonErr(ctx.rid, "Payload for stor.", 400, "payload_too_large");
  }
  const p = parseBody(raw);
  const isObs = OBSERVABILITY_TYPES.includes(p.type as any);
  const isValid = VALID_TYPES.includes(p.type as any);
  if (!p.type) return jsonErr(ctx.rid, "Mangler type.", 400, "missing_type");
  if (!p.timestamp) return jsonErr(ctx.rid, "Mangler timestamp.", 400, "missing_timestamp");
  if (!isValid && !isObs) return jsonErr(ctx.rid, "Ugyldig type.", 400, "invalid_type");
  if (p.feature && !VALID_FEATURES.includes(p.feature as any)) return jsonErr(ctx.rid, "Ugyldig feature.", 400, "invalid_feature");

  const metadata = { pageId: p.pageId, variantId: p.variantId, feature: p.feature, patchPresent: p.patchPresent, timestamp: p.timestamp } as Record<string, unknown>;
  if (p.message != null) metadata.message = p.message;
  if (p.kind != null) metadata.kind = p.kind;
  if (p.count != null) metadata.count = p.count;
  if (ctx.scope?.email != null) metadata.actor_email = ctx.scope.email;

  if (isLocalDevContentReserveEnabled()) {
    return jsonOk(
      ctx.rid,
      { ok: true, skipped: true, degraded: true, reason: "LOCAL_DEV_CONTENT_RESERVE" },
      202,
    );
  }

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = supabaseAdmin();
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const row = buildAiActivityLogRow({
    action: "editor_ai_metric",
    page_id: p.pageId ?? null,
    variant_id: p.variantId ?? null,
    actor_user_id: ctx.scope?.userId ?? null,
    tool: p.type,
    environment: "preview",
    locale: "nb",
    metadata: meta,
  });
  const { error: insertError } = await supabase.from("ai_activity_log").insert(row);
  if (insertError) {
    if (isContentBackendUnavailableError(insertError)) {
      return jsonOk(
        ctx.rid,
        { ok: true, skipped: true, degraded: true, reason: "CONTENT_BACKEND_UNREACHABLE" },
        202,
      );
    }
    return jsonErr(ctx.rid, "Kunne ikke lagre metrics-event.", 500, "METRICS_INSERT_FAILED");
  }
  return jsonOk(ctx.rid, { ok: true }, 200);
  });
}