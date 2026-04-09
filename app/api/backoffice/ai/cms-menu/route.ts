/**
 * POST /api/backoffice/ai/cms-menu
 *
 * CMS-only AI assist: menu copy + week suggestions. Suggestions only — no Sanity/DB writes.
 * Superadmin + existing AI entitlements (same pattern as text-improve).
 */
import type { NextRequest } from "next/server";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { isAIEnabled } from "@/lib/ai/runner";
import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE, DEFAULT_AI_EDITOR_RATE_LIMIT } from "@/lib/ai/rateLimit";
import { prepareAiResponseForClient } from "@/lib/ai/responseSafety";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import {
  generateMenuFromIntent,
  improveMenuContent,
  suggestWeeklyVariation,
  validateMenuQuality,
} from "@/lib/ai/cmsAiActions";
import { getProductPlan } from "@/lib/cms/getProductPlan";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Action = "improve" | "generate" | "validate" | "week_suggest" | "meta_allowlist";

function parseAction(v: unknown): Action | null {
  if (
    v === "improve" ||
    v === "generate" ||
    v === "validate" ||
    v === "week_suggest" ||
    v === "meta_allowlist"
  ) {
    return v;
  }
  return null;
}

function safeStr(s: unknown, max: number): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

function safeAllergenList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const inputObj =
    o.input != null && typeof o.input === "object" && !Array.isArray(o.input)
      ? (o.input as Record<string, unknown>)
      : {};
  const merged: Record<string, unknown> = { ...o, ...inputObj };
  delete merged.input;

  const action = parseAction(merged.action);
  if (!action) return jsonErr(ctx.rid, "Ugyldig action.", 400, "BAD_REQUEST");

  const locale = merged.locale === "en" ? "en" : "nb";

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

  const runCtx = { companyId, userId };

  if (action === "meta_allowlist") {
    const planName = merged.plan === "luxus" ? "luxus" : "basis";
    const pp = await getProductPlan(planName);
    return jsonOk(ctx.rid, { action, plan: planName, allowedMeals: pp?.allowedMeals ?? [] }, 200);
  }

  if (!isAIEnabled()) return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");

  const identity = ctx.scope?.email ?? ctx.scope?.sub ?? "anon";
  const rl = checkAiRateLimit(identity, `${AI_RATE_LIMIT_SCOPE}:cms-menu`, DEFAULT_AI_EDITOR_RATE_LIMIT);
  if (!rl.allowed) {
    const extraHeaders: HeadersInit | undefined =
      rl.retryAfterSeconds != null ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined;
    return jsonErr(ctx.rid, "Rate limit exceeded. Prøv igjen senere.", 429, "RATE_LIMIT", undefined, extraHeaders);
  }

  const m = merged;

  async function softLog(meta: Record<string, unknown>) {
    try {
      const { error } = await supabaseAdmin().from("ai_activity_log").insert(
        buildAiActivityLogRow({
          action: "cms_menu_ai",
          page_id: null,
          variant_id: null,
          actor_user_id: ctx.scope?.email ?? null,
          tool: "cms_menu_ai",
          metadata: { ...meta, action },
        })
      );
      if (error) {
        const { opsLog } = await import("@/lib/ops/log");
        opsLog("ai_activity_log.insert_failed", { route: "cms-menu", detail: error.message });
      }
    } catch {
      /* non-blocking */
    }
  }

  try {
    if (action === "improve") {
      const menu = {
        mealType: m.mealType != null ? safeStr(m.mealType, 64) : null,
        title: safeStr(m.title, 200),
        description: m.description != null ? safeStr(m.description, 4000) : "",
        allergens: safeAllergenList(m.allergens),
      };
      if (!menu.title) return jsonErr(ctx.rid, "title er påkrevd.", 422, "MISSING_TITLE");
      const out = await improveMenuContent(menu, runCtx, locale);
      if (out.ok === false) return jsonErr(ctx.rid, out.error, 500, out.code ?? "AI_ERROR");
      const prepared = prepareAiResponseForClient(out.data);
      if (!prepared.ok) {
        return jsonErr(ctx.rid, prepared.message ?? "AI response contained unsafe content.", 400, "AI_SAFETY_REJECTED");
      }
      void softLog({ subAction: "improve", ok: true });
      return jsonOk(ctx.rid, { action, ...prepared.data }, 200);
    }

    if (action === "generate") {
      const intent = safeStr(m.intent, 500);
      if (!intent) return jsonErr(ctx.rid, "intent er påkrevd.", 422, "MISSING_INTENT");
      const planName = m.plan === "luxus" ? "luxus" : "basis";
      const pp = await getProductPlan(planName);
      const allowed = pp?.allowedMeals?.length ? pp.allowedMeals : [];
      if (!allowed.length) {
        return jsonErr(ctx.rid, "CMS productPlan mangler allowedMeals.", 503, "CMS_PLAN_MISSING");
      }
      const out = await generateMenuFromIntent(intent, allowed, runCtx, locale);
      if (out.ok === false) {
        void softLog({ subAction: "generate", ok: false, code: out.code });
        return jsonErr(ctx.rid, out.error, out.code === "MISSING_ALLOWLIST" ? 422 : 500, out.code ?? "AI_ERROR");
      }
      const prepared = prepareAiResponseForClient(out.data);
      if (!prepared.ok) {
        return jsonErr(ctx.rid, prepared.message ?? "AI response contained unsafe content.", 400, "AI_SAFETY_REJECTED");
      }
      void softLog({ subAction: "generate", ok: true });
      return jsonOk(ctx.rid, { action, ...prepared.data, plan: planName }, 200);
    }

    if (action === "validate") {
      const menu = {
        mealType: m.mealType != null ? safeStr(m.mealType, 64) : null,
        title: safeStr(m.title, 200),
        description: m.description != null ? safeStr(m.description, 4000) : "",
        allergens: safeAllergenList(m.allergens),
      };
      if (!menu.title) return jsonErr(ctx.rid, "title er påkrevd.", 422, "MISSING_TITLE");
      const result = await validateMenuQuality(menu, runCtx, locale);
      const prepared = prepareAiResponseForClient(result);
      if (!prepared.ok) {
        return jsonErr(ctx.rid, prepared.message ?? "AI response contained unsafe content.", 400, "AI_SAFETY_REJECTED");
      }
      void softLog({ subAction: "validate", ok: true, score: result.score });
      return jsonOk(ctx.rid, { action, ...prepared.data }, 200);
    }

    if (action === "week_suggest") {
      const planName = m.plan === "luxus" ? "luxus" : "basis";
      const pp = await getProductPlan(planName);
      const allowed = pp?.allowedMeals?.length ? pp.allowedMeals : [];
      if (!allowed.length) {
        return jsonErr(ctx.rid, "CMS productPlan mangler allowedMeals.", 503, "CMS_PLAN_MISSING");
      }
      const out = await suggestWeeklyVariation(planName, allowed, runCtx, locale);
      if (out.ok === false) {
        void softLog({ subAction: "week_suggest", ok: false, code: out.code });
        return jsonErr(ctx.rid, out.error, 500, out.code ?? "AI_ERROR");
      }
      const prepared = prepareAiResponseForClient(out.data);
      if (!prepared.ok) {
        return jsonErr(ctx.rid, prepared.message ?? "AI response contained unsafe content.", 400, "AI_SAFETY_REJECTED");
      }
      void softLog({ subAction: "week_suggest", ok: true });
      return jsonOk(ctx.rid, { action, plan: planName, ...prepared.data }, 200);
    }

    return jsonErr(ctx.rid, "Ukjent handling.", 400, "BAD_REQUEST");
  } catch (e) {
    void softLog({ subAction: action, ok: false, error: String(e instanceof Error ? e.message : e) });
    return jsonErr(ctx.rid, "Uventet feil.", 500, "SERVER_ERROR");
  }
  });
}
