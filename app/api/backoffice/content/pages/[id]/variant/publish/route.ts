import type { NextRequest } from "next/server";
import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import { CONTENT_AUDIT_ACTION_PUBLISH } from "@/lib/cms/contentAuditActions";
import { isLocalDevContentReserveEnabled } from "@/lib/cms/contentLocalDevReserve";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { logEvent } from "@/lib/observability/eventLogger";
import { copyVariantBodyToProd, getScheduledReleaseForVariant } from "@/lib/backoffice/content/releasesRepo";
import { getWorkflow, resetToDraftAfterPublish } from "@/lib/backoffice/content/workflowRepo";
import {
  getLocalCmsWorkflow,
  isLocalCmsRuntimeError,
  publishLocalCmsVariant,
} from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withApiAiEntrypoint(request, "POST", async () => {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const { id: pageId } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");
  const variantId = typeof o.variantId === "string" ? o.variantId.trim() : "";
  const env = o.env === "prod" ? "prod" : "staging";
  const locale = (o.locale === "en" ? "en" : "nb") as "nb" | "en";
  if (!pageId?.trim() || !variantId) {
    return jsonErr(ctx.rid, "Mangler page id eller variantId.", 400, "BAD_REQUEST");
  }
  if (env !== "prod") {
    return jsonErr(ctx.rid, "Publisering krever env=prod (staging er ikke tillatt for denne operasjonen).", 400, "INVALID_ENV");
  }
  return withCmsPageDocumentGate("api/backoffice/content/pages/[id]/variant/publish/POST", async () => {
  try {
    if (isLocalCmsRuntimeEnabled()) {
      const workflow = getLocalCmsWorkflow({ pageId, variantId, env, locale });
      if (workflow.state !== "approved") {
        return jsonErr(
          ctx.rid,
          "Innhold må være godkjent før publisering til prod.",
          403,
          "workflow_not_approved",
          { state: workflow.state }
        );
      }
      const out = publishLocalCmsVariant({
        pageId,
        variantId,
        locale,
        actorEmail: ctx.scope?.email ?? null,
        actorUserId: ctx.scope?.userId ?? null,
      });
      return jsonOk(ctx.rid, out, 200);
    }

    if (isLocalDevContentReserveEnabled()) {
      return jsonErr(
        ctx.rid,
        "Lokal content-reserve er skrivebeskyttet. Publisering er blokkert i reserve-modus.",
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
    const scheduledReleaseId = await getScheduledReleaseForVariant(supabase as any, variantId);
    if (scheduledReleaseId) {
      return jsonErr(
        ctx.rid,
        "Varianten er med i en planlagt release. Bruk Releases eller fjern den fra release først.",
        409,
        "variant_in_release",
        { releaseId: scheduledReleaseId }
      );
    }
    if (env === "prod") {
      const workflow = await getWorkflow(supabase as any, variantId, env, locale);
      if (workflow.state !== "approved") {
        return jsonErr(
          ctx.rid,
          "Innhold må være godkjent før publisering til prod.",
          403,
          "workflow_not_approved",
          { state: workflow.state }
        );
      }
    }
    if (env === "prod") {
      await copyVariantBodyToProd(supabase as any, pageId, variantId, locale, {
        versionCreatedByUserId: ctx.scope?.userId ?? null,
      });
      await resetToDraftAfterPublish(supabase as any, variantId, pageId, env, locale, ctx.scope?.email ?? null);
      await (supabase as any).from("content_audit_log").insert({
        page_id: pageId,
        variant_id: variantId,
        environment: env,
        locale,
        action: CONTENT_AUDIT_ACTION_PUBLISH,
        actor_email: ctx.scope?.email ?? null,
        metadata: { source: "variant_publish_api" },
      });
      const { recordContentPublished } = await import("@/lib/ai/memory/recordOutcome");
      await recordContentPublished(supabase, { pageId, variantId, env: "prod", sourceRid: ctx.rid });
      logEvent({
        type: "cms.content_publish",
        source: "/api/backoffice/content/pages/[id]/variant/publish",
        userId: ctx.scope?.userId ?? null,
        companyId: ctx.scope?.companyId ?? null,
        rid: ctx.rid,
        status: "success",
        durationMs: null,
        metadata: { pageId, variantId, locale, env: "prod" },
      });
    }
    return jsonOk(
      ctx.rid,
      {
        published: true,
        pageId,
        variantId,
        locale,
        environment: env,
      },
      200,
    );
  } catch (e) {
    if (isLocalCmsRuntimeError(e)) {
      return jsonErr(ctx.rid, e.message, e.status, e.code, e.detail);
    }
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
  });
  });
}