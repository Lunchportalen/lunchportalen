import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { getScheduledReleaseForVariant } from "@/lib/backoffice/content/releasesRepo";
import { getWorkflow, resetToDraftAfterPublish } from "@/lib/backoffice/content/workflowRepo";

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
  try {
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
      return jsonErr(ctx.rid, "Variant is part of a scheduled release", 409, "variant_in_release", { message: "Variant is part of a scheduled release" });
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
      await resetToDraftAfterPublish(supabase as any, variantId, pageId, env, locale, ctx.scope?.email ?? null);
    }
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, published: true }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
}