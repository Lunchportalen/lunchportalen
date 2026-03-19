// app/api/superadmin/agreements/[agreementId]/resume/route.ts

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

    // Before snapshot (for audit + idempotency)
    const before = await admin
      .from("company_agreements")
      .select(
        "id, company_id, status, end_date, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, notes, created_at, updated_at"
      )
      .eq("id", agreementId)
      .maybeSingle();

    if (before.error) return jsonErr(rid, "Kunne ikke lese avtale.", 500, { code: "READ_FAILED", detail: before.error });
    if (!before.data?.id) return jsonErr(rid, "Fant ikke avtale.", 404, "NOT_FOUND");

    const companyId = String((before.data as any).company_id ?? "").trim();
    if (!isUuid(companyId)) {
      return jsonErr(rid, "Avtalen har ugyldig company_id.", 500, {
        code: "DATA_INVALID",
        detail: { company_id: (before.data as any).company_id },
      });
    }

    const beforeStatusRaw = (before.data as any).status ?? null;
    const beforeStatus = normalizeCompanyAgreementStatus(beforeStatusRaw);

    if (!beforeStatus) {
      return jsonErr(rid, "Avtalen har ukjent status. Kan ikke aktivere.", 409, {
        code: "INVALID_CURRENT_STATUS",
        detail: { status: beforeStatusRaw },
      });
    }

    // Idempotency: already active
    if (beforeStatus === "ACTIVE") {
      // ✅ B-LOCK: DO NOT update companies.status here
      opsLog("agreement.resume.idempotent", {
        rid,
        agreement_id: agreementId,
        company_id: companyId,
        note: "Already ACTIVE. B-LOCK: companies.status not modified here.",
      });

      return jsonOk(rid, { ok: true, rid, agreement: before.data, idempotent: true }, 200);
    }

    const allowedFrom: CompanyAgreementStatus[] = ["PAUSED"];
    if (!allowedFrom.includes(beforeStatus)) {
      return jsonErr(rid, "Ugyldig overgang. Kan bare gjenoppta PAUSED-avtaler.", 409, {
        code: "INVALID_TRANSITION",
        detail: { from: beforeStatus, to: "ACTIVE" },
      });
    }

    // If there is another ACTIVE agreement for this company, pause it first to keep invariant.
    const otherActive = await admin
      .from("company_agreements")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .neq("id", agreementId);

    if (otherActive.error) {
      return jsonErr(rid, "Kunne ikke lese eksisterende ACTIVE.", 500, { code: "READ_ACTIVE_FAILED", detail: otherActive.error });
    }

    let pausedOtherActiveIds: string[] = [];
    if ((otherActive.data ?? []).length > 0) {
      const pause = await admin
        .from("company_agreements")
        .update({ status: "PAUSED", updated_at: new Date().toISOString(), updated_by: scope.user_id ?? null } as any)
        .eq("company_id", companyId)
        .eq("status", "ACTIVE")
        .neq("id", agreementId)
        .select("id");

      if (pause.error) {
        return jsonErr(rid, "Kunne ikke pause annen ACTIVE-avtale.", 500, { code: "PAUSE_OTHER_ACTIVE_FAILED", detail: pause.error });
      }
      pausedOtherActiveIds = (pause.data ?? []).map((r: any) => String(r.id));
    }

    // Company name for audit summary (best-effort)
    const company = await admin.from("companies").select("id, name, status").eq("id", companyId).maybeSingle();
    if (company.error) return jsonErr(rid, "Kunne ikke hente firma.", 500, { code: "COMPANY_LOOKUP_FAILED", detail: company.error });

    // Resume agreement
    const upd = await admin
      .from("company_agreements")
      .update({
        status: "ACTIVE",
        end_date: null,
        updated_at: new Date().toISOString(),
        updated_by: scope.user_id ?? null,
      } as any)
      .eq("id", agreementId)
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .single();

    if (upd.error) return jsonErr(rid, "Kunne ikke aktivere avtale.", 500, { code: "RESUME_FAILED", detail: upd.error });

    /**
     * ✅ B-LOCK
     * companies.status skal IKKE settes her.
     * Én sannhetskilde for company status:
     * - app/api/company/create -> pending
     * - app/api/superadmin/companies/set-status -> pending|active|paused|closed
     */
    opsLog("agreement.resume.company_status_not_modified", {
      rid,
      agreement_id: agreementId,
      company_id: companyId,
      paused_other_active_ids: pausedOtherActiveIds,
      note: "B-LOCK: companies.status is managed only by company/create and companies/set-status.",
    });

    // Audit (best-effort)
    const audit = await writeAuditEvent({
      scope,
      action: "agreement.resume",
      entity_type: "company_agreement",
      entity_id: agreementId,
      summary: `Satte avtale til ACTIVE for ${safeText((company.data as any)?.name) ?? "company"} (${companyId})`,
      detail: {
        rid,
        company_id: companyId,
        company_name: safeText((company.data as any)?.name),
        paused_other_active_ids: pausedOtherActiveIds,
        before: before.data,
        after: upd.data,
      },
    });

    return jsonOk(
      rid,
      {
        agreement: upd.data,
        paused_other_active_ids: pausedOtherActiveIds,
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
