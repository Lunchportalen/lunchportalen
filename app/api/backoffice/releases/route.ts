import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { createRelease, listReleases } from "@/lib/backoffice/content/releasesRepo";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest) {
  const { scopeOr401, requireRoleOr403, q: qParam } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const env = (qParam(request, "environment") ?? "prod") === "staging" ? "staging" : "prod";
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const list = await listReleases(supabase as any, env);
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, releases: list }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, message, 500, "SERVER_ERROR", { detail: String(e) });
  }
}

export async function POST(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  let body: unknown;
  try { body = await request.json(); } catch { return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST"); }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const environment = o.environment === "staging" ? "staging" : "prod";
  const publish_at = typeof o.publish_at === "string" ? o.publish_at : null;
  if (!name) return jsonErr(ctx.rid, "Mangler name.", 400, "BAD_REQUEST");
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const release = await createRelease(supabase as any, { name, environment, publish_at, createdBy: ctx.scope?.email ?? null });
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, release }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, message, 500, "SERVER_ERROR", { detail: String(e) });
  }
}
