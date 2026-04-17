// app/api/superadmin/agreements/[agreementId]/activate/route.ts
// Legacy: oppdaterer kun rader i public.company_agreements (kontrakt-/bindingsspor).
// Operativ ledger-avtale (public.agreements, PENDING→ACTIVE) skal ALLTID gå via POST …/approve → lp_agreement_approve_active (inkl. firma ACTIVE når RPC krever det).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { type NextRequest } from "next/server";
import { isUuid, safeText } from "@/lib/agreements/normalize";
import { normalizeCompanyAgreementStatus, type CompanyAgreementStatus } from "@/lib/agreements/companyAgreementStatus";
import { writeAuditEvent } from "@/lib/audit/write";
import { opsLog } from "@/lib/ops/log";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

type Ctx = { params: { agreementId: string } | Promise<{ agreementId: string }> };

function onlyIds(rows: any[] | null | undefined) {
  return (rows ?? []).map((r: any) => String(r?.id ?? "")).filter(Boolean);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const g = await scopeOr401(req);
  if (g.ok === false) return g.response;

  const deny = requireRoleOr403(g.ctx, "superadmin.agreements.legacy_company_agreements_activate", ["superadmin"]);
  if (deny) return deny;

  const rid = g.ctx.rid;
  const scopeForAudit = {
    user_id: g.ctx.scope.userId,
    email: g.ctx.scope.email,
    role: g.ctx.scope.role,
  };
  const actorUserId = String(g.ctx.scope.userId ?? "").trim() || null;

  try {
    const params = await Promise.resolve(ctx.params as any);
    const agreementId = String(params?.agreementId ?? "").trim();
    if (!isUuid(agreementId)) return jsonErr(rid, "Ugyldig agreementId.", 400, "BAD_REQUEST");

    const admin = supabaseAdmin();

    const ledger = await admin.from("agreements").select("id,status").eq("id", agreementId).maybeSingle();
    if (!ledger.error && ledger.data?.id) {
      const ls = String((ledger.data as { status?: unknown }).status ?? "").toUpperCase();
      if (ls === "PENDING") {
        return jsonErr(
          rid,
          "Dette er et ledger-avtaleutkast (PENDING). Bruk den eksplisitte godkjenn-flyten: POST /api/superadmin/agreements/{id}/approve (eller «Godkjenn avtale» på avtalesiden). Da settes avtalen aktiv og firma aktiveres i samme canonical RPC når modellen krever det.",
          409,
          "USE_LEDGER_APPROVE",
          { agreement_id: agreementId, ledger_status: ls },
        );
      }
      return jsonErr(
        rid,
        "Denne ID-en tilhører ledger-avtalen (public.agreements). Bruk ledger-flyten (godkjenn/pause), ikke company_agreements-aktivering.",
        409,
        "LEDGER_AGREEMENT_WRONG_ENDPOINT",
        { agreement_id: agreementId, ledger_status: ls },
      );
    }

    // Hent avtalen vi skal aktivere (før)
    const cur = await admin
      .from("company_agreements")
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .eq("id", agreementId)
      .maybeSingle();

    if (cur.error) return jsonErr(rid, "Kunne ikke hente avtale.", 500, "READ_FAILED", cur.error);
    if (!cur.data?.id) return jsonErr(rid, "Fant ikke avtale.", 404, "NOT_FOUND");

    const companyId = String((cur.data as any).company_id ?? "").trim();
    if (!isUuid(companyId)) {
      return jsonErr(rid, "Avtalen har ugyldig company_id.", 500, "DATA_INVALID", { company_id: (cur.data as any).company_id });
    }

    // Hent firma (for audit summary)
    const company = await admin.from("companies").select("id, name").eq("id", companyId).maybeSingle();
    if (company.error) return jsonErr(rid, "Kunne ikke hente firma.", 500, "COMPANY_LOOKUP_FAILED", company.error);

    const curStatusRaw = (cur.data as any).status ?? null;
    const curStatus = normalizeCompanyAgreementStatus(curStatusRaw);

    if (!curStatus) {
      return jsonErr(rid, "Avtalen har ukjent status. Kan ikke aktivere.", 409, "INVALID_CURRENT_STATUS", { status: curStatusRaw });
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
      return jsonErr(rid, "Ugyldig overgang. Kan bare aktivere PENDING, PAUSED eller DRAFT-avtaler.", 409, "INVALID_TRANSITION", {
        from: curStatus,
        to: "ACTIVE",
      });
    }

    // Snapshot: eksisterende ACTIVE før vi endrer
    const beforeActive = await admin
      .from("company_agreements")
      .select("id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, start_date, end_date, updated_at")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE");

    if (beforeActive.error) {
      return jsonErr(rid, "Kunne ikke lese eksisterende ACTIVE.", 500, "READ_FAILED", beforeActive.error);
    }

    // Pause eksisterende ACTIVE for firmaet (idempotent)
    const pause = await admin
      .from("company_agreements")
      .update({ status: "PAUSED", updated_at: new Date().toISOString(), updated_by: actorUserId } as any)
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .select("id");

    if (pause.error) {
      return jsonErr(rid, "Kunne ikke pause eksisterende ACTIVE.", 500, "PAUSE_ACTIVE_FAILED", pause.error);
    }

    // Aktiver valgt avtale
    const upd = await admin
      .from("company_agreements")
      .update({ status: "ACTIVE", updated_at: new Date().toISOString(), updated_by: actorUserId } as any)
      .eq("id", agreementId)
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .single();

    if (upd.error) return jsonErr(rid, "Kunne ikke aktivere avtale.", 500, "ACTIVATE_FAILED", upd.error);

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
      scope: scopeForAudit,
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
