// app/api/superadmin/agreements/[agreementId]/activate/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getScope, allowSuperadminOrCompanyAdmin } from "@/lib/auth/scope";
import { isUuid, safeText } from "@/lib/agreements/normalize";
import { writeAuditEvent } from "@/lib/audit/write";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

type Ctx = { params: { agreementId: string } | Promise<{ agreementId: string }> };

function onlyIds(rows: any[] | null | undefined) {
  return (rows ?? []).map((r: any) => String(r?.id ?? "")).filter(Boolean);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const rid = `sa_activate_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);
    if (scope.role !== "superadmin") return jsonErr(403, rid, "FORBIDDEN", "Kun superadmin kan aktivere avtale.");

    const params = await Promise.resolve(ctx.params);
    const agreementId = String((params as any)?.agreementId ?? "").trim();
    if (!isUuid(agreementId)) return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig agreementId.");

    const admin = supabaseAdmin();

    // Hent avtalen vi skal aktivere (før)
    const cur = await admin
      .from("company_agreements")
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .eq("id", agreementId)
      .maybeSingle();

    if (cur.error) return jsonErr(500, rid, "READ_FAILED", "Kunne ikke hente avtale.", cur.error);
    if (!cur.data?.id) return jsonErr(404, rid, "NOT_FOUND", "Fant ikke avtale.");

    const companyId = String((cur.data as any).company_id);

    // Hent firma (for audit summary)
    const company = await admin.from("companies").select("id, name").eq("id", companyId).maybeSingle();
    if (company.error) return jsonErr(500, rid, "COMPANY_LOOKUP_FAILED", "Kunne ikke hente firma.", company.error);

    // Snapshot: eksisterende ACTIVE før vi endrer
    const beforeActive = await admin
      .from("company_agreements")
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, start_date, end_date, updated_at"
      )
      .eq("company_id", companyId)
      .eq("status", "ACTIVE");

    if (beforeActive.error) return jsonErr(500, rid, "READ_FAILED", "Kunne ikke lese eksisterende ACTIVE.", beforeActive.error);

    // Pause eksisterende ACTIVE for firmaet (idempotent)
    const pause = await admin
      .from("company_agreements")
      .update({ status: "PAUSED", updated_at: new Date().toISOString(), updated_by: scope.user_id ?? null } as any)
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .select("id");

    if (pause.error) return jsonErr(500, rid, "PAUSE_ACTIVE_FAILED", "Kunne ikke pause eksisterende ACTIVE.", pause.error);

    // Aktiver valgt avtale
    const upd = await admin
      .from("company_agreements")
      .update({ status: "ACTIVE", updated_at: new Date().toISOString(), updated_by: scope.user_id ?? null } as any)
      .eq("id", agreementId)
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .single();

    if (upd.error) return jsonErr(500, rid, "ACTIVATE_FAILED", "Kunne ikke aktivere avtale.", upd.error);

    // Audit (best-effort)
    const audit = await writeAuditEvent({
      scope,
      action: "agreement.activate",
      entity_type: "company_agreement",
      entity_id: agreementId,
      summary: `Aktiverte avtale for ${safeText((company.data as any)?.name) ?? "company"} (${companyId})`,
      detail: {
        rid,
        company_id: companyId,
        company_name: safeText((company.data as any)?.name),
        paused_previous_active_ids: onlyIds(pause.data),
        before_target: cur.data,
        before_active: beforeActive.data ?? [],
        after_target: upd.data,
      },
    });

    return jsonOk({
      ok: true,
      rid,
      agreement: upd.data,
      audit_ok: audit.ok,
      audit_event: audit.ok ? (audit as any).audit : null,
      audit_error: audit.ok ? null : (audit as any).error,
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(status, rid, code, String(e?.message ?? e));
  }
}

export async function GET() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST for å aktivere avtale.");
}

export async function PUT() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST for å aktivere avtale.");
}

export async function DELETE() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST for å aktivere avtale.");
}
