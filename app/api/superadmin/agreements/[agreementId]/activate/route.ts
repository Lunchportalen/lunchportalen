// app/api/superadmin/agreements/[agreementId]/activate/route.ts
// CANONICAL — agreement activation to ACTIVE (superadmin); system tests use lp_agreement_* RPCs with the same end state.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { type NextRequest } from "next/server";
import { getScope, allowSuperadminOrCompanyAdmin } from "@/lib/auth/scope";
import { isUuid, safeText } from "@/lib/agreements/normalize";
import { normalizeCompanyAgreementStatus, type CompanyAgreementStatus } from "@/lib/agreements/companyAgreementStatus";
import { writeAuditEvent } from "@/lib/audit/write";
import { opsLog } from "@/lib/ops/log";
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

    // ✅ Hard rule
    if (scope.role !== "superadmin") {
      return jsonErr(rid, "Kun superadmin kan aktivere avtale.", 403, "FORBIDDEN");
    }

    const params = await Promise.resolve(ctx.params as any);
    const agreementId = String(params?.agreementId ?? "").trim();
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

    const companyId = String((cur.data as any).company_id ?? "").trim();
    if (!isUuid(companyId)) {
      return jsonErr(rid, "Avtalen har ugyldig company_id.", 500, { code: "DATA_INVALID", detail: { company_id: (cur.data as any).company_id } });
    }

    // Hent firma (for audit summary)
    const company = await admin.from("companies").select("id, name").eq("id", companyId).maybeSingle();
    if (company.error) return jsonErr(rid, "Kunne ikke hente firma.", 500, { code: "COMPANY_LOOKUP_FAILED", detail: company.error });

    const curStatusRaw = (cur.data as any).status ?? null;
    const curStatus = normalizeCompanyAgreementStatus(curStatusRaw);

    if (!curStatus) {
      return jsonErr(rid, "Avtalen har ukjent status. Kan ikke aktivere.", 409, {
        code: "INVALID_CURRENT_STATUS",
        detail: { status: curStatusRaw },
      });
    }

    // ✅ Idempotent: already ACTIVE
    if (curStatus === "ACTIVE") {
      opsLog("agreement.activate.idempotent", {
        rid,
        agreement_id: agreementId,
        company_id: companyId,
        note: "Already ACTIVE. B-LOCK: companies.status not modified here.",
      });

      return jsonOk(
        rid,
        {
          agreement: cur.data,
          idempotent: true,
        },
        200
      );
    }

    const allowedFrom: CompanyAgreementStatus[] = ["PENDING", "PAUSED", "DRAFT"];
    if (!allowedFrom.includes(curStatus)) {
      return jsonErr(rid, "Ugyldig overgang. Kan bare aktivere PENDING, PAUSED eller DRAFT-avtaler.", 409, {
        code: "INVALID_TRANSITION",
        detail: { from: curStatus, to: "ACTIVE" },
      });
    }

    // Snapshot: eksisterende ACTIVE før vi endrer
    const beforeActive = await admin
      .from("company_agreements")
      .select("id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, start_date, end_date, updated_at")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE");

    if (beforeActive.error) {
      return jsonErr(rid, "Kunne ikke lese eksisterende ACTIVE.", 500, { code: "READ_FAILED", detail: beforeActive.error });
    }

    // Pause eksisterende ACTIVE for firmaet (idempotent)
    const pause = await admin
      .from("company_agreements")
      .update({ status: "PAUSED", updated_at: new Date().toISOString(), updated_by: scope.user_id ?? null } as any)
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .select("id");

    if (pause.error) {
      return jsonErr(rid, "Kunne ikke pause eksisterende ACTIVE.", 500, { code: "PAUSE_ACTIVE_FAILED", detail: pause.error });
    }

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

    /**
     * ✅ B-LOCK
     * companies.status skal IKKE settes her.
     * Én sannhetskilde for company status:
     * - app/api/company/create -> pending
     * - app/api/superadmin/companies/set-status -> pending|active|paused|closed
     */
    opsLog("agreement.activate.company_status_not_modified", {
      rid,
      agreement_id: agreementId,
      company_id: companyId,
      paused_previous_active_ids: onlyIds(pause.data),
      note: "B-LOCK: companies.status is managed only by company/create and companies/set-status.",
    });

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

    return jsonOk(
      rid,
      {
        agreement: upd.data,
        audit_ok: (audit as any)?.ok === true,
        audit_event: (audit as any)?.ok ? (audit as any).audit : null,
        audit_error: (audit as any)?.ok ? null : (audit as any)?.error ?? null,
      },
      200
    );
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(rid, String(e?.message ?? e), status, code);
  }
}

export async function GET(_req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å aktivere avtale.", 405, "METHOD_NOT_ALLOWED");
}

export async function PUT(_req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å aktivere avtale.", 405, "METHOD_NOT_ALLOWED");
}

export async function DELETE(_req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å aktivere avtale.", 405, "METHOD_NOT_ALLOWED");
}
