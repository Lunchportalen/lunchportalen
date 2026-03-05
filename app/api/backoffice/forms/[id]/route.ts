import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";

function deny(s: { response?: Response; res?: Response; ctx?: { rid: string } }) {
  if (s?.response) return s.response; if (s?.res) return s.res;
  return jsonErr(s?.ctx?.rid ?? "r", "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return deny(s);
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const { id } = await context.params;
  if (!id?.trim()) return jsonErr(s.ctx.rid, "Mangler id", 400, "BAD_REQUEST");
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("forms").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return jsonErr(s.ctx.rid, "Ikke funnet", 404, "NOT_FOUND");
    return jsonOk(s.ctx.rid, { ok: true, rid: s.ctx.rid, form: data }, 200);
  } catch (e) {
    return jsonErr(s.ctx.rid, e instanceof Error ? e.message : "Error", 500, "SERVER_ERROR");
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return deny(s);
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const { id } = await context.params;
  if (!id?.trim()) return jsonErr(s.ctx.rid, "Mangler id", 400, "BAD_REQUEST");
  let body: unknown;
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin(); body = await request.json(); } catch { return jsonErr(s.ctx.rid, "Ugyldig JSON", 400, "BAD_REQUEST"); }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(s.ctx.rid, "Body må være et objekt", 400, "BAD_REQUEST");
  const now = new Date().toISOString();
  const upd: Record<string, unknown> = { updated_at: now };
  if (typeof o.name === "string") upd.name = o.name.trim();
  if (o.schema != null && typeof o.schema === "object") upd.schema = o.schema;
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("forms").update(upd).eq("id", id);
    if (error) throw new Error(error.message);
    const { data } = await supabase.from("forms").select("*").eq("id", id).single();
    return jsonOk(s.ctx.rid, { ok: true, rid: s.ctx.rid, form: data }, 200);
  } catch (e) {
    return jsonErr(s.ctx.rid, e instanceof Error ? e.message : "Error", 500, "SERVER_ERROR");
  }
}
