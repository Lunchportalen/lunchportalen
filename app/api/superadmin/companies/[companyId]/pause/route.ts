// app/api/superadmin/companies/[companyId]/pause/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function ok(body: any, status = 200) {
  return NextResponse.json({ ok: true, ...body }, { status, headers: noStore() });
}
function fail(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}
function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isUuid(v: any) {
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
  } catch {}
}

type Body = { note?: string };

export async function POST(req: Request, ctx: RouteCtx) {
  const rid = `sa_pause_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { companyId } = await ctx.params;
    if (!isUuid(companyId)) return fail(400, "bad_request", "Ugyldig companyId", { rid });

    const sbUser = await supabaseServer();
    const { data: auth } = await sbUser.auth.getUser();
    if (!auth?.user) return fail(401, "unauthorized", "Ikke innlogget", { rid });

    const actorEmail = normEmail(auth.user.email);
    if (actorEmail !== "superadmin@lunchportalen.no") return fail(403, "forbidden", "Kun superadmin", { rid });

    const body = (await req.json().catch(() => ({}))) as Body;
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

    const sb = supabaseAdmin();

    const { data: company, error: cErr } = await sb.from("companies").select("id,name,status").eq("id", companyId).maybeSingle();
    if (cErr) return fail(500, "db_error", "Kunne ikke lese firma", { rid, cErr });
    if (!company) return fail(404, "not_found", "Firma finnes ikke", { rid });

    const st = String(company.status ?? "").toLowerCase();
    if (st === "paused") {
      await tryAudit(sb, {
        actor_user_id: auth.user.id,
        actor_email: auth.user.email ?? null,
        actor_role: "superadmin",
        action: "company_pause_noop",
        entity_type: "company",
        entity_id: companyId,
        summary: "Already paused",
        detail: { rid },
        created_at: new Date().toISOString(),
      });
      return ok({ rid, company, meta: { alreadyPaused: true } });
    }

    const now = new Date().toISOString();
    const up = await sb
      .from("companies")
      .update({ status: "paused", pause_note: note, paused_at: now, updated_at: now } as any)
      .eq("id", companyId)
      .select("id,name,status,updated_at")
      .single();

    // fallback hvis kolonner ikke finnes
    if (up.error && isMissingColumn(up.error)) {
      const up2 = await sb
        .from("companies")
        .update({ status: "paused", updated_at: now } as any)
        .eq("id", companyId)
        .select("id,name,status,updated_at")
        .single();

      if (up2.error) return fail(500, "db_error", "Kunne ikke pause firma", { rid, upErr: up2.error });

      await tryAudit(sb, {
        actor_user_id: auth.user.id,
        actor_email: auth.user.email ?? null,
        actor_role: "superadmin",
        action: "company_pause",
        entity_type: "company",
        entity_id: companyId,
        summary: `${company.status} -> paused`,
        detail: { rid, from: company.status, to: "paused", note },
        created_at: now,
      });

      return ok({ rid, company: up2.data });
    }

    if (up.error) return fail(500, "db_error", "Kunne ikke pause firma", { rid, upErr: up.error });

    await tryAudit(sb, {
      actor_user_id: auth.user.id,
      actor_email: auth.user.email ?? null,
      actor_role: "superadmin",
      action: "company_pause",
      entity_type: "company",
      entity_id: companyId,
      summary: `${company.status} -> paused`,
      detail: { rid, from: company.status, to: "paused", note },
      created_at: now,
    });

    return ok({ rid, company: up.data });
  } catch (e: any) {
    return fail(500, "server_error", "Uventet feil i pause.", { rid, error: String(e?.message ?? e) });
  }
}
