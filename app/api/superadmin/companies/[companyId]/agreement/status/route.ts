// app/api/superadmin/companies/[companyId]/agreement/status/route.ts
// ✅ Små, trygge status-endringer: ACTIVE / PAUSED / CLOSED
// - Viktig: getScope() skal ha NextRequest (ikke SupabaseClient)
// - Oppdaterer company_agreements (ikke view) + holder companies.status i sync
// - Idempotent: hvis allerede samme status -> ok:true

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getScope, allowSuperadminOrCompanyAdmin } from "@/lib/auth/scope";
import { isUuid } from "@/lib/agreements/normalize";
import { writeAuditEvent } from "@/lib/audit/write";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function rid() {
  return crypto.randomUUID();
}
function jsonErr(status: number, r: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid: r, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };
type Status = "ACTIVE" | "PAUSED" | "CLOSED";

export async function POST(req: NextRequest, ctx: Ctx) {
  const r = rid();

  try {
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);
    if (scope.role !== "superadmin") return jsonErr(403, r, "forbidden", "Kun superadmin");

    const params = await Promise.resolve(ctx.params as any);
    const companyId = String(params?.companyId ?? "").trim();
    if (!isUuid(companyId)) return jsonErr(400, r, "bad_request", "Ugyldig companyId");

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return jsonErr(400, r, "bad_json", "Ugyldig JSON");
    }

    const s = String(body?.status ?? "").trim().toUpperCase() as Status;
    if (s !== "ACTIVE" && s !== "PAUSED" && s !== "CLOSED") {
      return jsonErr(400, r, "bad_request", "status må være ACTIVE/PAUSED/CLOSED");
    }

    const admin = supabaseAdmin();

    // Finn "current" (foretrukket ACTIVE ellers nyeste) for audit + for å vite agreementId
    const { data: list, error: listErr } = await admin
      .from("company_agreements")
      .select("id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, updated_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (listErr) return jsonErr(500, r, "db_error", "Kunne ikke lese avtaler", listErr);

    const rows = (list ?? []) as any[];
    const current = rows.find((x) => String(x.status).toUpperCase() === "ACTIVE") ?? rows[0] ?? null;
    if (!current?.id) return jsonErr(404, r, "not_found", "Fant ingen avtale for firmaet");

    // Idempotent
    const prevStatus = String(current.status ?? "").toUpperCase();
    if (prevStatus === s) {
      return jsonOk({ ok: true, rid: r, company_id: companyId, agreement_id: current.id, status: s, idempotent: true });
    }

    // Hvis vi setter ACTIVE: pause alle andre ACTIVE først (sikker invariant)
    let pausedOtherActiveIds: string[] = [];
    if (s === "ACTIVE") {
      const pause = await admin
        .from("company_agreements")
        .update({ status: "PAUSED", updated_at: new Date().toISOString(), updated_by: scope.user_id ?? null } as any)
        .eq("company_id", companyId)
        .eq("status", "ACTIVE")
        .neq("id", current.id)
        .select("id");
      if (pause.error) return jsonErr(500, r, "db_error", "Kunne ikke pause annen ACTIVE-avtale", pause.error);
      pausedOtherActiveIds = (pause.data ?? []).map((x: any) => String(x.id));
    }

    // Oppdater valgt agreement
    const patch: any = {
      status: s,
      updated_at: new Date().toISOString(),
      updated_by: scope.user_id ?? null,
    };
    // Hvis CLOSED: sett end_date hvis mangler
    if (s === "CLOSED" && !current.end_date) {
      // Oslo-dato: enkel og stabil nok her
      const oslo = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" })
        .format(new Date());
      patch.end_date = oslo; // YYYY-MM-DD
    }
    // Hvis ACTIVE: nullstill end_date (typisk)
    if (s === "ACTIVE") patch.end_date = null;

    const upd = await admin
      .from("company_agreements")
      .update(patch)
      .eq("id", current.id)
      .select("id, company_id, status, end_date, updated_at")
      .single();

    if (upd.error) return jsonErr(500, r, "db_error", "Kunne ikke oppdatere status", upd.error);

    // Sync companies.status
    await admin.from("companies").update({ status: s, updated_at: new Date().toISOString() } as any).eq("id", companyId);

    // Audit (best-effort)
    const audit = await writeAuditEvent({
      scope,
      action: "agreement.status",
      entity_type: "company_agreement",
      entity_id: String(current.id),
      summary: `Endret status til ${s} for company (${companyId})`,
      detail: {
        rid: r,
        company_id: companyId,
        agreement_id: current.id,
        from: prevStatus,
        to: s,
        paused_other_active_ids: pausedOtherActiveIds,
        before: current,
        after: upd.data,
      },
    });

    return jsonOk({
      ok: true,
      rid: r,
      company_id: upd.data?.company_id ?? companyId,
      agreement_id: upd.data?.id ?? current.id,
      status: (upd.data?.status ?? s) as Status,
      end_date: upd.data?.end_date ?? null,
      paused_other_active_ids: pausedOtherActiveIds,
      audit_ok: (audit as any)?.ok === true,
      audit_event: (audit as any)?.ok ? (audit as any).audit : null,
      audit_error: (audit as any)?.ok ? null : (audit as any)?.error ?? null,
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(status, r, code, String(e?.message ?? e));
  }
}

export async function GET() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST.");
}
export async function PUT() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST.");
}
export async function DELETE() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST.");
}
