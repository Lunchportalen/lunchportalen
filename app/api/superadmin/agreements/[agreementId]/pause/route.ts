// app/api/superadmin/agreements/[agreementId]/pause/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { getScope, allowSuperadminOrCompanyAdmin } from "@/lib/auth/scope";
import { isUuid, safeText } from "@/lib/agreements/normalize";
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
      return jsonErr(rid, "Kun superadmin kan pause avtale.", 403, "FORBIDDEN");
    }

    const params = await Promise.resolve(ctx.params as any);
    const agreementId = String(params?.agreementId ?? "").trim();
    if (!isUuid(agreementId)) return jsonErr(rid, "Ugyldig agreementId.", 400, "BAD_REQUEST");

    const admin = supabaseAdmin();

    // Before snapshot (for audit)
    const before = await admin
      .from("company_agreements")
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
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

    // Idempotency: already paused
    if (String((before.data as any).status) === "PAUSED") {
      opsLog("agreement.pause.idempotent", {
        rid,
        agreement_id: agreementId,
        company_id: companyId,
        note: "Already PAUSED. B-LOCK: companies.status not modified here.",
      });

      return jsonOk(
        rid,
        {
          agreement: before.data,
          idempotent: true,
        },
        200
      );
    }

    // Company name (best-effort for audit summary)
    const company = await admin.from("companies").select("id, name, status").eq("id", companyId).maybeSingle();
    if (company.error) return jsonErr(rid, "Kunne ikke hente firma.", 500, { code: "COMPANY_LOOKUP_FAILED", detail: company.error });

    // Update -> PAUSED
    const upd = await admin
      .from("company_agreements")
      .update({
        status: "PAUSED",
        updated_at: new Date().toISOString(),
        updated_by: scope.user_id ?? null,
      } as any)
      .eq("id", agreementId)
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .single();

    if (upd.error) return jsonErr(rid, "Kunne ikke pause avtale.", 500, { code: "PAUSE_FAILED", detail: upd.error });

    /**
     * ✅ B-LOCK
     * companies.status skal IKKE settes her.
     * Én sannhetskilde for company status:
     * - app/api/company/create -> pending
     * - app/api/superadmin/companies/set-status -> pending|active|paused|closed
     */
    opsLog("agreement.pause.company_status_not_modified", {
      rid,
      agreement_id: agreementId,
      company_id: companyId,
      agreement_status_after: "PAUSED",
      note: "B-LOCK: companies.status is managed only by company/create and companies/set-status.",
    });

    // Audit (best-effort)
    const audit = await writeAuditEvent({
      scope,
      action: "agreement.pause",
      entity_type: "company_agreement",
      entity_id: agreementId,
      summary: `Satte avtale til PAUSED for ${safeText((company.data as any)?.name) ?? "company"} (${companyId})`,
      detail: {
        rid,
        company_id: companyId,
        company_name: safeText((company.data as any)?.name),
        before: before.data,
        after: upd.data,
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
  return jsonErr(rid, "Bruk POST for å pause avtale.", 405, "METHOD_NOT_ALLOWED");
}

export async function PUT(_req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å pause avtale.", 405, "METHOD_NOT_ALLOWED");
}

export async function DELETE(_req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å pause avtale.", 405, "METHOD_NOT_ALLOWED");
}
