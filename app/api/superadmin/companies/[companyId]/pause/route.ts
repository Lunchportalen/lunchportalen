// app/api/superadmin/companies/[companyId]/pause/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };
type Body = { note?: string };

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function isMissingTable(err: any) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "").toLowerCase();
  return code === "42P01" || msg.includes("does not exist");
}

function isMissingColumn(err: any) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "").toLowerCase();
  return code === "42703" || msg.includes("could not find the") || msg.includes("column") || msg.includes("does not exist");
}

async function tryAudit(sb: any, payload: any) {
  try {
    const a = await sb.from("audit_events").insert(payload);
    if (!a.error) return;
    if (isMissingTable(a.error) || isMissingColumn(a.error)) {
      await sb.from("audit_log").insert(payload);
    }
  } catch {
    // best effort
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.pause.POST", ["superadmin"]);
  if (deny) return deny;

  const params = await ctx.params;
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const body = ((await readJson(req)) ?? {}) as Body;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  const sb = supabaseAdmin();

  try {
    const { data: company, error: cErr } = await sb.from("companies").select("id,name,status").eq("id", companyId).maybeSingle();
    if (cErr) return jsonErr(a.rid, "Kunne ikke lese firma.", 500, { code: "DB_ERROR", detail: cErr });
    if (!company) return jsonErr(a.rid, "Firma finnes ikke.", 404, "NOT_FOUND");

    const st = String((company as any).status ?? "").toLowerCase();

    if (st === "paused") {
      await tryAudit(sb, {
        actor_user_id: a.scope?.userId ?? null,
        actor_email: a.scope?.email ?? null,
        actor_role: "superadmin",
        action: "company_pause_noop",
        entity_type: "company",
        entity_id: companyId,
        summary: "Already paused",
        detail: { rid: a.rid },
        created_at: new Date().toISOString(),
        rid: a.rid,
      });

      return jsonOk(a.rid, { ok: true, rid: a.rid, company, meta: { alreadyPaused: true } }, 200);
    }

    const now = new Date().toISOString();

    let up = await sb
      .from("companies")
      .update({ status: "paused", pause_note: note, paused_at: now, updated_at: now } as any)
      .eq("id", companyId)
      .select("id,name,status,updated_at")
      .single();

    if (up.error && isMissingColumn(up.error)) {
      up = await sb
        .from("companies")
        .update({ status: "paused", updated_at: now } as any)
        .eq("id", companyId)
        .select("id,name,status,updated_at")
        .single();
    }

    if (up.error) return jsonErr(a.rid, "Kunne ikke pause firma.", 500, { code: "DB_ERROR", detail: up.error });

    await tryAudit(sb, {
      actor_user_id: a.scope?.userId ?? null,
      actor_email: a.scope?.email ?? null,
      actor_role: "superadmin",
      action: "company_pause",
      entity_type: "company",
      entity_id: companyId,
      summary: `${(company as any).status} -> paused`,
      detail: { rid: a.rid, from: (company as any).status, to: "paused", note },
      created_at: now,
      rid: a.rid,
    });

    return jsonOk(a.rid, { ok: true, rid: a.rid, company: up.data }, 200);
  } catch (e: any) {
    return jsonErr(a.rid, "Uventet feil i pause.", 500, { code: "SERVER_ERROR", detail: { message: String(e?.message ?? e) } });
  }
}

