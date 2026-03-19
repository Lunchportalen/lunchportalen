import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, q } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listExperiments, createExperiment } from "@/lib/backoffice/experiments/experimentsRepo";
import { isExperimentType, isValidExperimentId } from "@/lib/backoffice/experiments/model";

export const dynamic = "force-dynamic";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const pageId = q(request, "pageId") ?? undefined;
  const status = q(request, "status") ?? undefined;

  try {
    const supabase = supabaseAdmin();
    const rows = await listExperiments(supabase, { pageId, status });
    return jsonOk(ctx.rid, { ok: true, data: rows }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "List experiments failed";
    return jsonErr(ctx.rid, msg, 500, "LIST_FAILED");
  }
}

export async function POST(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const page_id = typeof o.page_id === "string" ? o.page_id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const type = isExperimentType(o.type) ? o.type : undefined;
  const variant_id = typeof o.variant_id === "string" ? o.variant_id.trim() || null : null;
  const config = o.config != null && typeof o.config === "object" && !Array.isArray(o.config) ? o.config as Record<string, unknown> : {};
  const experiment_id = typeof o.experiment_id === "string" && isValidExperimentId(o.experiment_id) ? o.experiment_id.trim() : undefined;

  if (!page_id) return jsonErr(ctx.rid, "Mangler page_id.", 400, "BAD_REQUEST");
  if (!name) return jsonErr(ctx.rid, "Mangler name.", 400, "BAD_REQUEST");
  if (!type) return jsonErr(ctx.rid, "Mangler eller ugyldig type (headline, cta, hero_body).", 400, "BAD_REQUEST");

  const variants = Array.isArray(config.variants) ? config.variants : [];
  if (variants.length < 2) return jsonErr(ctx.rid, "Minst to varianter kreves.", 400, "BAD_REQUEST");

  try {
    const supabase = supabaseAdmin();
    const row = await createExperiment(supabase, {
      page_id,
      variant_id,
      name,
      type,
      status: "draft",
      experiment_id,
      config: { variants },
      created_by: ctx.scope?.email ?? null,
    });
    return jsonOk(ctx.rid, { ok: true, data: row }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create experiment failed";
    return jsonErr(ctx.rid, msg, 500, "CREATE_FAILED");
  }
}
