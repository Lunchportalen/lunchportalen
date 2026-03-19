import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { isAIEnabled } from "@/lib/ai/provider";
import { getToolPolicy } from "@/lib/ai/tools/registry";
import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE } from "@/lib/ai/rateLimit";
import { getAiFallback } from "@/lib/ai/fallbackHandler";
import { validateAndPrepareAiResponse, SUGGEST_OUTPUT_SCHEMA } from "@/lib/ai/responseSafety";
import { runSuggest } from "@/lib/ai/suggestMotor";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";

/** Privileged: superadmin only. Tool policy also enforces role per tool (defense in depth). Unauthenticated or wrong role fails closed (401/403). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  if (!isAIEnabled()) {
    return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");
  }

  const email = ctx.scope?.email ?? "anon";
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const environment =
    o.environment === "staging" ? "staging" : o.environment === "preview" ? "preview" : "prod";
  const env = o.env === "staging" ? "staging" : o.env === "preview" ? "preview" : environment;
  const locale = o.locale === "en" ? "en" : "nb";
  const tool = typeof o.tool === "string" ? o.tool.trim() : "";
  const input = o.input && typeof o.input === "object" ? (o.input as Record<string, unknown>) : {};
  if (!tool) return jsonErr(ctx.rid, "Mangler tool.", 400, "BAD_REQUEST");

  const policy = getToolPolicy(tool);
  if (!policy) return jsonErr(ctx.rid, "Unknown AI tool.", 400, "UNKNOWN_TOOL");
  if (policy.role !== "superadmin") return jsonErr(ctx.rid, "Tool not allowed for this role.", 403, "TOOL_FORBIDDEN");
  if (policy.rateLimit !== null) {
    const scope = `${AI_RATE_LIMIT_SCOPE}:suggest:${tool}`;
    const rl = checkAiRateLimit(email, scope, policy.rateLimit);
    if (!rl.allowed) {
      const extraHeaders: HeadersInit | undefined =
        rl.retryAfterSeconds != null ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined;
      return jsonErr(ctx.rid, "Rate limit exceeded. Prøv igjen senere.", 429, "RATE_LIMIT", undefined, extraHeaders);
    }
  }

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const result = await runSuggest({
    tool,
    locale,
    input,
    rawBody: o,
    environment: env,
    createdBy: email,
    getSupabase: () => supabaseAdmin(),
  });

  if (!result.ok) {
    try {
      await supabaseAdmin().from("ai_activity_log").insert(
        buildAiActivityLogRow({
          action: "suggest_failed",
          page_id: (o.pageId as string) ?? null,
          variant_id: (o.variantId as string) ?? null,
          actor_user_id: email,
          tool,
          environment: env,
          locale,
          metadata: { error: result.error.slice(0, 500) },
        })
      );
    } catch {
      // Best-effort: do not mask the AI failure response
    }
    if (result.error === "AI_DISABLED") {
      return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");
    }
    if (result.error === "PATCH_NOT_ALLOWED") {
      return jsonErr(ctx.rid, "Tool may not output patch.", 400, "PATCH_NOT_ALLOWED");
    }
    if (result.error === "PATCH_INVALID") {
      return jsonErr(ctx.rid, "Invalid patch shape.", 400, "PATCH_INVALID");
    }
    if (result.error === "PATCH_TOO_LARGE") {
      return jsonErr(ctx.rid, "Patch exceeds maxOps.", 400, "PATCH_TOO_LARGE");
    }
    const fallback = getAiFallback(tool, { ...input, locale });
    if (fallback) {
      return jsonOk(ctx.rid, {
        ok: true,
        rid: ctx.rid,
        suggestionId: null,
        suggestion: fallback.data,
        fallback: true,
        fallbackMessage: fallback.message,
      }, 200);
    }
    return jsonErr(ctx.rid, "AI suggestion failed.", 500, "AI_FAILED");
  }

  if (result.kind === "experiment") {
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, experimentId: result.experimentId, suggestionIds: result.suggestionIds }, 200);
  }

  if (result.kind === "image_candidates") {
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, suggestionId: result.suggestionId, suggestion: result.data }, 200);
  }

  const prepared = validateAndPrepareAiResponse(result.data, {
    outputSchema: SUGGEST_OUTPUT_SCHEMA,
    allowAdditionalProperties: true,
  });
  if (!prepared.ok) {
    const msg = prepared.message ?? (prepared.reason === "AI_SAFETY_REJECTED" ? "AI response contained unsafe content." : "AI response validation failed.");
    return jsonErr(ctx.rid, msg, 400, prepared.reason);
  }
  const data = prepared.data;
  if (data && typeof data === "object" && "patch" in data) {
    const patch = (data as { patch?: unknown }).patch;
    if (patch !== null && typeof patch === "object" && "version" in patch && "ops" in patch) {
      if (policy.patchAllowed !== true) {
        return jsonErr(ctx.rid, "Tool may not output patch.", 400, "PATCH_NOT_ALLOWED");
      }
      const p = patch as { version: number; ops: unknown[] };
      if (p.version !== 1 || !Array.isArray(p.ops)) {
        return jsonErr(ctx.rid, "Invalid patch shape.", 400, "PATCH_INVALID");
      }
      if (policy.maxOps !== null && p.ops.length > policy.maxOps) {
        return jsonErr(ctx.rid, "Patch exceeds maxOps.", 400, "PATCH_TOO_LARGE");
      }
    }
  }

  let suggestionId: string | null = null;
  try {
    const supabase = supabaseAdmin();
    const { data: inserted, error: insertErr } = await supabase
      .from("ai_suggestions")
      .insert({
        page_id: (o.pageId as string) ?? null,
        variant_id: (o.variantId as string) ?? null,
        environment: env,
        locale,
        tool,
        input,
        output: prepared.data,
        created_by: email,
      })
      .select("id")
      .single();

    if (insertErr) {
      return jsonErr(ctx.rid, "Kunne ikke lagre forslag (sporbarhet).", 500, "SUGGESTION_INSERT_FAILED");
    }
    if (inserted && typeof inserted.id === "string") {
      suggestionId = inserted.id;
    }

    const { error: activityLogError } = await supabase.from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "suggest",
        page_id: (o.pageId as string) ?? null,
        variant_id: (o.variantId as string) ?? null,
        actor_user_id: email,
        tool,
        environment: env,
        locale,
        prompt_tokens: result.usage?.promptTokens ?? null,
        completion_tokens: result.usage?.completionTokens ?? null,
        model: result.model ?? null,
        metadata: {
          inputKeys: Object.keys(input).slice(0, 20),
          suggestionId,
          toolPolicy: { patchAllowed: policy.patchAllowed, maxOps: policy.maxOps, rateLimit: policy.rateLimit },
          toolDocs: { title: policy.docs.title },
        },
      })
    );
    if (activityLogError) {
      return jsonErr(ctx.rid, "Kunne ikke logge forslag.", 500, "SUGGESTION_LOG_FAILED");
    }
  } catch (e) {
    return jsonErr(ctx.rid, "Kunne ikke lagre forslag.", 500, "SUGGESTION_INSERT_FAILED");
  }

  return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, suggestionId, suggestion: prepared.data }, 200);
}
