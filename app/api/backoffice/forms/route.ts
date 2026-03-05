import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";

function deny(s: { response?: Response; res?: Response; ctx?: { rid: string } }) {
  if (s?.response) return s.response; if (s?.res) return s.res;
  return jsonErr(s?.ctx?.rid ?? "r", "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest) {
  const { scopeOr401, requireRoleOr403, q: qParam } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return deny(s);
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const env = qParam(request, "environment") === "staging" ? "staging" : "prod";
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const { data, error } = await supabaseAdmin().from("forms").select("*").eq("environment", env).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return jsonOk(s.ctx.rid, { ok: true, rid: s.ctx.rid, forms: data ?? [] }, 200);
  } catch (e) {
    return jsonErr(s.ctx.rid, e instanceof Error ? e.message : "Error", 500, "SERVER_ERROR");
  }
}

const DEFAULT_SCHEMA = { version: 1, fields: [], submitLabel: "Send", successMessage: "Takk!" };



export async function POST(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return deny(s);
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  let body: unknown;
  try { body = await request.json(); } catch { return jsonErr(s.ctx.rid, "Ugyldig JSON", 400, "BAD_REQUEST"); }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(s.ctx.rid, "Body må være et objekt", 400, "BAD_REQUEST");
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const env = o.environment === "staging" ? "staging" : "prod";
  const locale = o.locale === "en" ? "en" : "nb";
  if (!name) return jsonErr(s.ctx.rid, "Mangler name", 400, "BAD_REQUEST");
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const now = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin().from("forms").insert({ name, environment: env, locale, schema: o.schema ?? DEFAULT_SCHEMA, created_by: s.ctx.scope?.email ?? null, updated_at: now }).select().single();
    if (error) throw new Error(error.message);
    return jsonOk(s.ctx.rid, { ok: true, rid: s.ctx.rid, form: row }, 200);
  } catch (e) {
    return jsonErr(s.ctx.rid, e instanceof Error ? e.message : "Error", 500, "SERVER_ERROR");
  }
}


