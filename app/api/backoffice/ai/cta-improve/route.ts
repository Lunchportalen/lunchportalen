/**
 * POST /api/backoffice/ai/cta-improve
 *
 * Service boundary: AI editor CTA-improve action only.
 * - Request: narrow payload { blockId, title, body?, buttonLabel?, buttonHref? }
 * - Response: suggestion only { ok: true, suggestion, blockId }. No DB write. No content mutation.
 * - Editor decides whether to apply; this route never mutates content or tenant data.
 *
 * Auth: scopeOr401 + requireRoleOr403(superadmin), same as other backoffice AI routes.
 * Input: validated and length-clamped. No arbitrary prompt execution.
 */
import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/runner";
import { AI_RUNNER_TOOL, AiRunnerError, runAi } from "@/lib/ai/runner";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE, DEFAULT_AI_EDITOR_RATE_LIMIT } from "@/lib/ai/rateLimit";
import { prepareAiResponseForClient } from "@/lib/ai/responseSafety";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BLOCK_ID_MAX = 64;
const TITLE_MAX = 120;
const BODY_MAX = 600;
const BUTTON_LABEL_MAX = 60;
const HREF_MAX = 2048;

/** Allowed CTA AI actions; same response shape, intent can drive future LLM prompt. */
const CTA_ACTIONS = ["improve", "shorten", "clarify", "rewrite"] as const;
type CtaAction = (typeof CTA_ACTIONS)[number];
function parseAction(v: unknown): CtaAction {
  if (typeof v === "string" && (CTA_ACTIONS as readonly string[]).includes(v)) return v as CtaAction;
  return "improve";
}

function safeStr(s: unknown, max: number): string {
  const t = typeof s === "string" ? s.trim() : "";
  return t.slice(0, max);
}

/** Fallback: normalize and clamp CTA fields when provider fails or is disabled. */
function improveCtaToSuggestionFallback(input: {
  title: string;
  body?: string;
  buttonLabel?: string;
  buttonHref?: string;
}): { title: string; body?: string; buttonLabel?: string; buttonHref?: string } {
  const title = safeStr(input.title, TITLE_MAX) || "Tittel";
  const body = safeStr(input.body, BODY_MAX) || undefined;
  const buttonLabel = safeStr(input.buttonLabel, BUTTON_LABEL_MAX) || undefined;
  const buttonHref = safeStr(input.buttonHref, HREF_MAX) || undefined;
  return { title, body: body || undefined, buttonLabel: buttonLabel || undefined, buttonHref: buttonHref || undefined };
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
  const rl = checkAiRateLimit(identity, `${AI_RATE_LIMIT_SCOPE}:cta-improve`, DEFAULT_AI_EDITOR_RATE_LIMIT);
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

  const rawBlockId = typeof o.blockId === "string" ? o.blockId.trim() : "";
  if (rawBlockId.length > BLOCK_ID_MAX) {
    return jsonErr(ctx.rid, "blockId for lang.", 400, "BAD_REQUEST");
  }
  const blockId = rawBlockId;
  const action = parseAction(o.action);
  const title = typeof o.title === "string" ? o.title : "";
  const locale = o.locale === "en" ? "en" : "nb";
  const ctaInput = {
    title,
    body: typeof o.body === "string" ? o.body : undefined,
    buttonLabel: typeof o.buttonLabel === "string" ? o.buttonLabel : undefined,
    buttonHref: typeof o.buttonHref === "string" ? o.buttonHref : undefined,
  };

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

  let suggestion: ReturnType<typeof improveCtaToSuggestionFallback>;
  try {
    const { result } = await runAi({
      companyId,
      userId,
      tool: AI_RUNNER_TOOL.EDITOR_CTA,
      input: {
        title: ctaInput.title,
        body: ctaInput.body,
        buttonLabel: ctaInput.buttonLabel,
        buttonHref: ctaInput.buttonHref,
        action,
      },
      metadata: { locale },
    });
    suggestion =
      result && typeof result === "object" && !Array.isArray(result)
        ? (result as typeof suggestion)
        : improveCtaToSuggestionFallback(ctaInput);
  } catch (e) {
    if (
      e instanceof AiRunnerError &&
      [
        "PLAN_NOT_ALLOWED",
        "USAGE_LIMIT_EXCEEDED",
        "PROFITABILITY_BLOCK",
        "PROFITABILITY_CONTEXT_FAILED",
        "POLICY_DENIED",
        "ENTITLEMENTS_FAILED",
      ].includes(e.code)
    ) {
      const status =
        e.code === "PLAN_NOT_ALLOWED" ||
        e.code === "USAGE_LIMIT_EXCEEDED" ||
        e.code === "PROFITABILITY_BLOCK" ||
        e.code === "PROFITABILITY_CONTEXT_FAILED"
          ? 403
          : 500;
      return jsonErr(ctx.rid, e.message, status, e.code);
    }
    suggestion = improveCtaToSuggestionFallback(ctaInput);
  }

  const responsePayload = { ok: true, suggestion, blockId, action };
  const prepared = prepareAiResponseForClient(responsePayload);
  if (!prepared.ok) {
    return jsonErr(ctx.rid, prepared.message ?? "AI response contained unsafe content.", 400, "AI_SAFETY_REJECTED");
  }
  try {
    const { error } = await supabaseAdmin().from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "cta_improve",
        page_id: null,
        variant_id: null,
        actor_user_id: ctx.scope?.email ?? null,
        tool: "cta_improve",
        environment: "preview",
        locale,
        metadata: { action, blockId },
      })
    );
    if (error) {
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("ai_activity_log.insert_failed", { route: "cta-improve", action: "cta_improve", error: error.message });
    }
  } catch {
    // Best-effort: do not mask response
  }
  return jsonOk(ctx.rid, prepared.data, 200);
  });
}
