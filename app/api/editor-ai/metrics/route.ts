/**
 * Editor-AI metrics ingest (trinn 2).
 * POST: accept editor-AI event, validate, write to ai_activity_log.
 * Same auth pattern as other backoffice AI routes; Supabase-ready.
 */

import { NextRequest } from "next/server";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { makeRid, jsonOk, jsonErr } from "@/lib/http/respond";

const VALID_TYPES = [
  "editor_opened",
  "ai_action_triggered",
  "ai_result_received",
  "ai_patch_applied",
  "ai_save_after_action",
] as const;

const VALID_FEATURES = [
  "improve_page",
  "seo_optimize",
  "generate_sections",
  "structured_intent",
  "seo_inline",
  "hero_inline",
  "cta_inline",
] as const;

const MAX_BODY_KEYS = 20;

function safeStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function parseBody(body: unknown): {
  type: string;
  timestamp: string | null;
  pageId: string | null;
  variantId: string | null;
  feature: string | null;
  patchPresent: boolean | null;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { type: "", timestamp: null, pageId: null, variantId: null, feature: null, patchPresent: null };
  }
  const o = body as Record<string, unknown>;
  return {
    type: typeof o.type === "string" ? o.type : "",
    timestamp: safeStr(o.timestamp),
    pageId: safeStr(o.pageId),
    variantId: safeStr(o.variantId),
    feature: safeStr(o.feature),
    patchPresent: typeof o.patchPresent === "boolean" ? o.patchPresent : null,
  };
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return jsonErr(rid, "Body m� v�re et objekt.", 400, "invalid_body");
  }
  if (Object.keys(raw).length > MAX_BODY_KEYS) {
    return jsonErr(rid, "Payload for stor.", 400, "payload_too_large");
  }

  const { type, timestamp, pageId, variantId, feature, patchPresent } = parseBody(raw);

  if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return jsonErr(rid, "Mangler eller ugyldig type.", 400, "invalid_type");
  }
  if (!timestamp) {
    return jsonErr(rid, "Mangler timestamp.", 400, "missing_timestamp");
  }
  if (feature != null && feature !== "" && !VALID_FEATURES.includes(feature as (typeof VALID_FEATURES)[number])) {
    return jsonErr(rid, "Ugyldig feature.", 400, "invalid_feature");
  }

  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin", "company_admin"]);
  if (deny) return deny;

  const createdBy = ctx.scope?.email ?? null;

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    await supabase.from("ai_activity_log").insert({
      page_id: pageId ?? null,
      variant_id: variantId ?? null,
      environment: "preview",
      locale: "nb",
      action: "editor_ai_metric",
      tool: type,
      created_by: createdBy,
      metadata: {
        pageId: pageId ?? null,
        variantId: variantId ?? null,
        feature: feature ?? null,
        patchPresent: patchPresent ?? null,
        timestamp,
      },
    });
  } catch (_) {
    // best-effort; non-fatal
  }

  return jsonOk(rid, { ok: true }, 200);
}
