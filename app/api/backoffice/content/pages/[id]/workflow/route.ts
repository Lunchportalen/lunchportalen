import type { NextRequest } from "next/server";
import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import { isLocalDevContentReserveEnabled } from "@/lib/cms/contentLocalDevReserve";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import {
  getWorkflow,
  setWorkflow,
  getNextState,
  type WorkflowState,
  type WorkflowAction,
} from "@/lib/backoffice/content/workflowRepo";
import {
  getLocalCmsWorkflow,
  isLocalCmsRuntimeError,
  transitionLocalCmsWorkflow,
} from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";

const ENVS = ["prod", "staging"] as const;
const LOCALES = ["nb", "en"] as const;
const ACTIONS: WorkflowAction[] = ["submit_review", "approve", "reject", "reset_to_draft"];

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { scopeOr401, requireRoleOr403, q: qParam } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const { id: pageId } = await context.params;
  let variantId = qParam(request, "variantId") ?? "";
  const envRaw = qParam(request, "env") ?? "staging";
  const localeRaw = qParam(request, "locale") ?? "nb";
  const env = ENVS.includes(envRaw as any) ? envRaw : "staging";
  const locale = LOCALES.includes(localeRaw as any) ? localeRaw : "nb";
  if (!pageId?.trim()) {
    return jsonErr(ctx.rid, "Mangler page id.", 400, "BAD_REQUEST");
  }
  try {
    if (isLocalCmsRuntimeEnabled()) {
      const workflow = getLocalCmsWorkflow({ pageId, variantId, env, locale });
      return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, ...workflow }, 200);
    }

    if (isLocalDevContentReserveEnabled()) {
      return jsonOk(
        ctx.rid,
        {
          ok: true,
          rid: ctx.rid,
          variantId: null,
          state: "draft",
          updated_at: null,
          updated_by: null,
          degraded: true,
          reserve: true,
          missingVariant: true,
        },
        200,
      );
    }

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    if (!variantId?.trim()) {
      const { data: exact } = await supabase
        .from("content_page_variants")
        .select("id")
        .eq("page_id", pageId)
        .eq("locale", locale)
        .eq("environment", env)
        .maybeSingle();
      variantId = exact?.id ?? "";
    }
    if (!variantId) {
      return jsonOk(
        ctx.rid,
        {
          ok: true,
          rid: ctx.rid,
          variantId: null,
          state: "draft",
          updated_at: null,
          updated_by: null,
          missingVariant: true,
        },
        200,
      );
    }
    if (variantId) {
      const { data: variant } = await supabase
        .from("content_page_variants")
        .select("id")
        .eq("id", variantId)
        .eq("page_id", pageId)
        .maybeSingle();
      if (!variant) {
        return jsonErr(ctx.rid, "Variant tilhører ikke denne siden.", 400, "BAD_REQUEST");
      }
    }
    const workflow = await getWorkflow(supabase as any, variantId || pageId, env, locale);
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, variantId: variantId || null, state: workflow.state, updated_at: workflow.updated_at, updated_by: workflow.updated_by }, 200);
  } catch (e) {
    if (isLocalCmsRuntimeError(e)) {
      return jsonErr(ctx.rid, e.message, e.status, e.code, e.detail);
    }
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const { id: pageId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");
  const variantId = typeof o.variantId === "string" ? o.variantId.trim() : "";
  const envRaw = typeof o.env === "string" ? o.env : "staging";
  const localeRaw = typeof o.locale === "string" ? o.locale : "nb";
  const action = o.action;
  const env = ENVS.includes(envRaw as any) ? envRaw : "staging";
  const locale = LOCALES.includes(localeRaw as any) ? localeRaw : "nb";
  if (!pageId?.trim() || !variantId) {
    return jsonErr(ctx.rid, "Mangler page id eller variantId.", 400, "BAD_REQUEST");
  }
  if (typeof action !== "string" || !ACTIONS.includes(action as WorkflowAction)) {
    return jsonErr(ctx.rid, "Ugyldig action.", 400, "BAD_REQUEST");
  }
  return withCmsPageDocumentGate("api/backoffice/content/pages/[id]/workflow/POST", async () => {
  try {
    if (isLocalCmsRuntimeEnabled()) {
      const row = transitionLocalCmsWorkflow({
        pageId,
        variantId,
        env,
        locale,
        action: action as WorkflowAction,
        actorEmail: ctx.scope?.email ?? null,
      });
      return jsonOk(ctx.rid, {
        ok: true,
        rid: ctx.rid,
        workflow: { state: row.state, updated_at: row.updated_at, updated_by: row.updated_by },
      }, 200);
    }

    if (isLocalDevContentReserveEnabled()) {
      return jsonErr(
        ctx.rid,
        "Lokal content-reserve er skrivebeskyttet. Workflow-endringer er blokkert i reserve-modus.",
        503,
        "LOCAL_DEV_CONTENT_RESERVE_READONLY",
      );
    }

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data: variant } = await supabase
      .from("content_page_variants")
      .select("id")
      .eq("id", variantId)
      .eq("page_id", pageId)
      .maybeSingle();
    if (!variant) {
      return jsonErr(ctx.rid, "Variant tilhører ikke denne siden.", 400, "BAD_REQUEST");
    }
    const current = await getWorkflow(supabase as any, variantId, env, locale);
    const result = getNextState(current.state, action as WorkflowAction);
    if (!result.ok) {
      return jsonErr(ctx.rid, "Ugyldig workflow-overgang.", 400, "workflow_invalid_transition");
    }
    const actorEmail = ctx.scope?.email ?? null;
    const row = await setWorkflow(supabase as any, 
      variantId,
      pageId,
      env,
      locale,
      result.next,
      actorEmail,
      current.state,
      action as WorkflowAction
    );
    return jsonOk(ctx.rid, {
      ok: true,
      rid: ctx.rid,
      workflow: { state: row.state, updated_at: row.updated_at, updated_by: row.updated_by },
    }, 200);
  } catch (e) {
    if (isLocalCmsRuntimeError(e)) {
      return jsonErr(ctx.rid, e.message, e.status, e.code, e.detail);
    }
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
  });
}
