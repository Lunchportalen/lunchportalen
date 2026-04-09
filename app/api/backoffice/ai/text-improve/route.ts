/**
 * POST /api/backoffice/ai/text-improve
 *
 * Service boundary (HTTP): editor UI → this route → lib/ai/editorTextSuggest.
 * - Request: { text: string, action: "improve" | "shorten" }. Narrow payload; validated input.
 * - Response: { suggestion: string }. Suggestion only; no DB write; no content mutation.
 * - No arbitrary prompt execution; action allowlisted; text length-clamped.
 *
 * Auth: scopeOr401 + requireRoleOr403(superadmin). Same pattern as cta-improve.
 */
import type { NextRequest } from "next/server";
import { AiRunnerError } from "@/lib/ai/runner";
import { isAIEnabled } from "@/lib/ai/runner";
import {
  EDITOR_TEXT_ACTION,
  editorTextSuggestAsync,
  type EditorTextAction,
} from "@/lib/ai/editorTextSuggest";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE, DEFAULT_AI_EDITOR_RATE_LIMIT } from "@/lib/ai/rateLimit";
import { prepareAiResponseForClient } from "@/lib/ai/responseSafety";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TEXT_MAX = 2000;

function parseAction(v: unknown): EditorTextAction {
  if (typeof v === "string" && (EDITOR_TEXT_ACTION as readonly string[]).includes(v)) {
    return v as EditorTextAction;
  }
  return "improve";
}

function safeStr(s: unknown, max: number): string {
  const t = typeof s === "string" ? s.trim() : "";
  return t.slice(0, max);
}

export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;
  if (!isAIEnabled()) return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");

  const identity = ctx.scope?.email ?? ctx.scope?.sub ?? "anon";
  const rl = checkAiRateLimit(identity, `${AI_RATE_LIMIT_SCOPE}:text-improve`, DEFAULT_AI_EDITOR_RATE_LIMIT);
  if (!rl.allowed) {
    const extraHeaders: HeadersInit | undefined =
      rl.retryAfterSeconds != null ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined;
    return jsonErr(ctx.rid, "Rate limit exceeded. Prøv igjen senere.", 429, "RATE_LIMIT", undefined, extraHeaders);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const text = safeStr(o.text, TEXT_MAX);
  const action = parseAction(o.action);
  const locale = o.locale === "en" ? "en" : "nb";

  const envPlatformCompany =
    typeof process.env.CMS_AI_DEFAULT_COMPANY_ID === "string" ? process.env.CMS_AI_DEFAULT_COMPANY_ID.trim() : "";
  const companyId = (ctx.scope?.companyId ?? "").trim() || envPlatformCompany;
  const userId = (ctx.scope?.userId ?? ctx.scope?.sub ?? ctx.scope?.email ?? "").trim();
  if (!companyId) {
    return jsonErr(ctx.rid, "Mangler company_id på profil eller CMS_AI_DEFAULT_COMPANY_ID.", 422, "MISSING_COMPANY_ID");
  }
  if (!userId) {
    return jsonErr(ctx.rid, "Mangler brukeridentitet.", 422, "MISSING_USER_ID");
  }

  let suggestion: string;
  try {
    const out = await editorTextSuggestAsync({ text: text || "—", action, locale }, { companyId, userId });
    suggestion = out.suggestion;
  } catch (e) {
    if (e instanceof AiRunnerError) {
      const status =
        e.code === "PLAN_NOT_ALLOWED" ||
        e.code === "POLICY_DENIED" ||
        e.code === "USAGE_LIMIT_EXCEEDED" ||
        e.code === "PROFITABILITY_BLOCK" ||
        e.code === "PROFITABILITY_CONTEXT_FAILED"
          ? 403
          : e.code === "MISSING_COMPANY_ID" || e.code === "MISSING_USER_ID"
            ? 422
            : 500;
      return jsonErr(ctx.rid, e.message, status, e.code);
    }
    throw e;
  }

  const prepared = prepareAiResponseForClient({ suggestion });
  if (!prepared.ok) {
    return jsonErr(ctx.rid, prepared.message ?? "AI response contained unsafe content.", 400, "AI_SAFETY_REJECTED");
  }
  try {
    const { error } = await supabaseAdmin().from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "text_improve",
        page_id: null,
        variant_id: null,
        actor_user_id: ctx.scope?.email ?? null,
        tool: "text_improve",
        environment: "preview",
        locale,
        metadata: { action },
      })
    );
    if (error) {
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("ai_activity_log.insert_failed", { route: "text-improve", action: "text_improve", error: error.message });
    }
  } catch {
    // Best-effort: do not mask response
  }
  return jsonOk(ctx.rid, prepared.data, 200);
  });
}
