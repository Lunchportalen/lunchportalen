// app/api/superadmin/agreements/[agreementId]/activate/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { getScope, allowSuperadminOrCompanyAdmin } from "@/lib/auth/scope";
import { isUuid, safeText } from "@/lib/agreements/normalize";
import { writeAuditEvent } from "@/lib/audit/write";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type Ctx = { params: { agreementId: string } | Promise<{ agreementId: string }> };

function onlyIds(rows: any[] | null | undefined) {
  return (rows ?? []).map((r: any) => String(r?.id ?? "")).filter(Boolean);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();

  try {
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);
    if (scope.role !== "superadmin") return jsonErr(rid, "Kun superadmin kan aktivere avtale.", 403, "FORBIDDEN");

    const params = await Promise.resolve(ctx.params);
    const agreementId = String((params as any)?.agreementId ?? "").trim();
    if (!isUuid(agreementId)) return jsonErr(rid, "Ugyldig agreementId.", 400, "BAD_REQUEST");

    const admin = supabaseAdmin();

    // Hent avtalen vi skal aktivere (før)
    const cur = await admin
      .from("company_agreements")
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .eq("id", agreementId)
      .maybeSingle();

    if (cur.error) return jsonErr(rid, "Kunne ikke hente avtale.", 500, { code: "READ_FAILED", detail: cur.error });
    if (!cur.data?.id) return jsonErr(rid, "Fant ikke avtale.", 404, "NOT_FOUND");

    const companyId = String((cur.data as any).company_id);

    // Hent firma (for audit summary)
    const company = await admin.from("companies").select("id, name").eq("id", companyId).maybeSingle();
    if (company.error) return jsonErr(rid, "Kunne ikke hente firma.", 500, { code: "COMPANY_LOOKUP_FAILED", detail: company.error });

    // Snapshot: eksisterende ACTIVE før vi endrer
    const beforeActive = await admin
      .from("company_agreements")
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, start_date, end_date, updated_at"
      )
      .eq("company_id", companyId)
      .eq("status", "ACTIVE");

    if (beforeActive.error) return jsonErr(rid, "Kunne ikke lese eksisterende ACTIVE.", 500, { code: "READ_FAILED", detail: beforeActive.error });

    // Pause eksisterende ACTIVE for firmaet (idempotent)
    const pause = await admin
      .from("company_agreements")
      .update({ status: "PAUSED", updated_at: new Date().toISOString(), updated_by: scope.user_id ?? null } as any)
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .select("id");

    if (pause.error) return jsonErr(rid, "Kunne ikke pause eksisterende ACTIVE.", 500, { code: "PAUSE_ACTIVE_FAILED", detail: pause.error });

    // Aktiver valgt avtale
    const upd = await admin
      .from("company_agreements")
      .update({ status: "ACTIVE", updated_at: new Date().toISOString(), updated_by: scope.user_id ?? null } as any)
      .eq("id", agreementId)
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .single();

    if (upd.error) return jsonErr(rid, "Kunne ikke aktivere avtale.", 500, { code: "ACTIVATE_FAILED", detail: upd.error });

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

    return jsonOk(rid, {
      agreement: upd.data,
      audit_ok: audit.ok,
      audit_event: audit.ok ? (audit as any).audit : null,
      audit_error: audit.ok ? null : (audit as any).error,
    }, 200);
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(rid, String(e?.message ?? e), status, code);
  }
}

export async function GET(req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å aktivere avtale.", 405, "METHOD_NOT_ALLOWED");
}

export async function PUT(req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å aktivere avtale.", 405, "METHOD_NOT_ALLOWED");
}

export async function DELETE(req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å aktivere avtale.", 405, "METHOD_NOT_ALLOWED");
}

