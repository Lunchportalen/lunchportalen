// app/api/superadmin/companies/[companyId]/close/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };
type Body = { note?: string };

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

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(401, { rid }, "UNAUTHENTICATED", "Du må være innlogget.");
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.close.POST", ["superadmin"]);
  if (deny) return deny;

  const params = await ctx.params;
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(400, a, "BAD_REQUEST", "Ugyldig companyId.");

  const body = ((await readJson(req)) ?? {}) as Body;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  const sb = supabaseAdmin();

  try {
    const { data: company, error: cErr } = await sb.from("companies").select("id,name,status").eq("id", companyId).maybeSingle();
    if (cErr) return jsonErr(500, a, "DB_ERROR", "Kunne ikke lese firma.", cErr);
    if (!company) return jsonErr(404, a, "NOT_FOUND", "Firma finnes ikke.");

    const st = String((company as any).status ?? "").toLowerCase();

    // Idempotent
    if (st === "closed") {
      await tryAudit(sb, {
        actor_user_id: a.scope?.userId ?? null,
        actor_email: a.scope?.email ?? null,
        actor_role: "superadmin",
        action: "company_close_noop",
        entity_type: "company",
        entity_id: companyId,
        summary: "Already closed",
        detail: { rid: a.rid },
        created_at: new Date().toISOString(),
        rid: a.rid,
      });

      return jsonOk(a, { ok: true, rid: a.rid, company, meta: { alreadyClosed: true } }, 200);
    }

    const now = new Date().toISOString();

    let up = await sb
      .from("companies")
      .update({ status: "closed", close_note: note, closed_at: now, updated_at: now } as any)
      .eq("id", companyId)
      .select("id,name,status,updated_at")
      .single();

    // fallback hvis kolonner ikke finnes
    if (up.error && isMissingColumn(up.error)) {
      up = await sb
        .from("companies")
        .update({ status: "closed", updated_at: now } as any)
        .eq("id", companyId)
        .select("id,name,status,updated_at")
        .single();
    }

    if (up.error) return jsonErr(500, a, "DB_ERROR", "Kunne ikke close firma.", up.error);

    await tryAudit(sb, {
      actor_user_id: a.scope?.userId ?? null,
      actor_email: a.scope?.email ?? null,
      actor_role: "superadmin",
      action: "company_close",
      entity_type: "company",
      entity_id: companyId,
      summary: `${(company as any).status} -> closed`,
      detail: { rid: a.rid, from: (company as any).status, to: "closed", note },
      created_at: now,
      rid: a.rid,
    });

    return jsonOk(a, { ok: true, rid: a.rid, company: up.data }, 200);
  } catch (e: any) {
    return jsonErr(500, a, "SERVER_ERROR", "Uventet feil i close.", { message: String(e?.message ?? e) });
  }
}
