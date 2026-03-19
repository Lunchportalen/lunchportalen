import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";

function deny(s: { response?: Response; res?: Response; ctx?: { rid: string } }) {
  if (s?.response) return s.response;
  if (s?.res) return s.res;
  return jsonErr(s?.ctx?.rid ?? "rid_missing", "Ikke innlogget.", 401, "UNAUTHORIZED");
}

/** Serialize error for logging/detail; never "[object Object]". */
function serializeError(e: unknown): string {
  if (e == null) return "Unknown error";
  if (e instanceof Error) return e.message || e.name || "Error";
  if (typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  try {
    const s = JSON.stringify(e);
    return s.length > 500 ? s.slice(0, 500) + "…" : s;
  } catch {
    return String(e);
  }
}

/** True if error indicates public.forms missing (schema cache / relation does not exist). */
function isFormsTableMissingError(e: unknown): boolean {
  const code = typeof (e as { code?: string })?.code === "string" ? (e as { code: string }).code : "";
  const msg = serializeError(e).toLowerCase();
  return (
    code === "42P01" ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    (msg.includes("does not exist") && msg.includes("forms"))
  );
}

function logFormsIncident(ctx: { rid: string }, message: string, error: string, code?: string): void {
  try {
    import("@/lib/ops/log").then(({ opsLog }) => {
      opsLog("incident", { rid: ctx.rid, route: "/api/backoffice/forms", message, error, code: code ?? undefined });
    }).catch(() => {});
  } catch {
    // ignore
  }
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
    if (error) {
      const detailMsg = serializeError(error);
      const code = typeof (error as { code?: string })?.code === "string" ? (error as { code: string }).code : undefined;
      if (isFormsTableMissingError(error)) {
        logFormsIncident(s.ctx, "public.forms table missing or not in schema cache; returning empty list", detailMsg, code);
        return jsonOk(s.ctx.rid, { ok: true, rid: s.ctx.rid, forms: [] }, 200);
      }
      logFormsIncident(s.ctx, "GET forms failed", detailMsg, code);
      return jsonErr(s.ctx.rid, detailMsg || "Kunne ikke hente skjemaer.", 500, "SERVER_ERROR", { detail: detailMsg, code });
    }
    return jsonOk(s.ctx.rid, { ok: true, rid: s.ctx.rid, forms: data ?? [] }, 200);
  } catch (e) {
    const detailMsg = serializeError(e);
    const code = typeof (e as { code?: string })?.code === "string" ? (e as { code: string }).code : undefined;
    if (isFormsTableMissingError(e)) {
      logFormsIncident(s.ctx, "public.forms table missing or not in schema cache; returning empty list", detailMsg, code);
      return jsonOk(s.ctx.rid, { ok: true, rid: s.ctx.rid, forms: [] }, 200);
    }
    logFormsIncident(s.ctx, "GET forms failed", detailMsg, code);
    return jsonErr(s.ctx.rid, detailMsg || "Error", 500, "SERVER_ERROR", { detail: detailMsg, code });
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
    if (error) {
      const detailMsg = serializeError(error);
      const code = typeof (error as { code?: string })?.code === "string" ? (error as { code: string }).code : undefined;
      if (isFormsTableMissingError(error)) {
        logFormsIncident(s.ctx, "public.forms table missing; cannot create form", detailMsg, code);
        return jsonErr(s.ctx.rid, "Skjematabell er ikke tilgjengelig. Kjør migrasjoner for backoffice forms.", 503, "SERVICE_UNAVAILABLE", { detail: detailMsg, code });
      }
      logFormsIncident(s.ctx, "POST forms failed", detailMsg, code);
      return jsonErr(s.ctx.rid, detailMsg || "Kunne ikke opprette skjema.", 500, "SERVER_ERROR", { detail: detailMsg, code });
    }
    return jsonOk(s.ctx.rid, { ok: true, rid: s.ctx.rid, form: row }, 200);
  } catch (e) {
    const detailMsg = serializeError(e);
    const code = typeof (e as { code?: string })?.code === "string" ? (e as { code: string }).code : undefined;
    if (isFormsTableMissingError(e)) {
      logFormsIncident(s.ctx, "public.forms table missing; cannot create form", detailMsg, code);
      return jsonErr(s.ctx.rid, "Skjematabell er ikke tilgjengelig. Kjør migrasjoner for backoffice forms.", 503, "SERVICE_UNAVAILABLE", { detail: detailMsg, code });
    }
    logFormsIncident(s.ctx, "POST forms failed", detailMsg, code);
    return jsonErr(s.ctx.rid, detailMsg || "Error", 500, "SERVER_ERROR", { detail: detailMsg, code });
  }
}


