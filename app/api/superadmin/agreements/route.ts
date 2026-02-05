// app/api/superadmin/agreements/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { getScope, allowSuperadminOrCompanyAdmin } from "@/lib/auth/scope";
import {
  type AgreementStatus,
  type Tier,
  normalizeStatus,
  normalizeTier,
  isUuid,
  intOr,
  isoDateOrToday,
  safeText,
  isISODate,
} from "@/lib/agreements/normalize";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { writeAuditEvent } from "@/lib/audit/write";
import { opsLog } from "@/lib/ops/log";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function asISODateOrNull(v: any) {
  const s = safeText(v);
  if (!s) return null;
  return isISODate(s) ? s : null;
}

type CreateBody = {
  company_id: string;
  plan_tier: Tier;
  status?: AgreementStatus; // default DRAFT
  price_per_cuvert_nok?: number;
  delivery_days?: any;
  binding_months?: number;
  notice_months?: number;
  start_date?: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD | null
  notes?: string | null;
};

function clampNonNegInt(v: any, fallback: number) {
  const n = intOr(v, fallback);
  return Math.max(0, n);
}

export async function POST(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();

  try {
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    // ✅ Hard rule
    if (scope.role !== "superadmin") {
      return jsonErr(rid, "Kun superadmin kan opprette avtale.", 403, "FORBIDDEN");
    }

    const body = (await req.json().catch(() => null)) as Partial<CreateBody> | null;
    if (!body) return jsonErr(rid, "Mangler JSON body.", 400, "BAD_REQUEST");

    const company_id = String(body.company_id ?? "").trim();
    if (!isUuid(company_id)) return jsonErr(rid, "Ugyldig company_id.", 400, "BAD_REQUEST");

    const plan_tier: Tier = normalizeTier(body.plan_tier);
    const status: AgreementStatus = normalizeStatus(body.status ?? "DRAFT");

    // Pris: default 90/130 hvis ikke sendt, men må alltid være > 0
    const defaultPrice = plan_tier === "LUXUS" ? 130 : 90;
    const price_per_cuvert_nok =
      Number.isFinite(Number(body.price_per_cuvert_nok)) ? intOr(body.price_per_cuvert_nok, defaultPrice) : defaultPrice;

    if (!Number.isFinite(price_per_cuvert_nok) || price_per_cuvert_nok <= 0) {
      return jsonErr(rid, "price_per_cuvert_nok må være > 0.", 400, "BAD_REQUEST");
    }

    const deliveryNorm = normalizeDeliveryDaysStrict(body.delivery_days);
    if (deliveryNorm.unknown.length || deliveryNorm.days.length === 0) {
      opsLog("agreement.delivery_days.warning", {
        rid,
        company_id,
        agreement_id: null,
        unknown: deliveryNorm.unknown,
        days: deliveryNorm.days,
        raw: deliveryNorm.raw ?? null,
      });
      return jsonErr(rid, "Ugyldige leveringsdager.", 400, { code: "BAD_REQUEST", detail: {
        unknown: deliveryNorm.unknown,
        days: deliveryNorm.days,
      } });
    }
    const delivery_days = deliveryNorm.days;
    const binding_months = clampNonNegInt(body.binding_months, 12);
    const notice_months = clampNonNegInt(body.notice_months, 3);
    const start_date = isoDateOrToday(body.start_date);

    const end_date_raw = body.end_date ?? null;
    const end_date = end_date_raw === null ? null : asISODateOrNull(end_date_raw);
    if (end_date_raw != null && end_date == null) {
      return jsonErr(rid, "end_date må være YYYY-MM-DD eller null.", 400, "BAD_REQUEST");
    }

    // (valgfritt) sanity: end_date kan ikke være før start_date
    if (end_date && isISODate(start_date) && end_date < start_date) {
      return jsonErr(rid, "end_date kan ikke være før start_date.", 400, { code: "BAD_REQUEST", detail: { start_date, end_date } });
    }

    const notes = safeText(body.notes) ?? null;

    const admin = supabaseAdmin();

    // Sikre at company finnes (bedre feilmelding enn FK)
    const company = await admin.from("companies").select("id, name, status").eq("id", company_id).maybeSingle();
    if (company.error) return jsonErr(rid, "Kunne ikke hente firma.", 500, { code: "COMPANY_LOOKUP_FAILED", detail: company.error });
    if (!company.data?.id) return jsonErr(rid, "Fant ikke firma.", 404, "NOT_FOUND");

    // Snapshot: eksisterende ACTIVE før vi evt pauser (for audit)
    const beforeActive = await admin
      .from("company_agreements")
      .select("id, status, plan_tier, price_per_cuvert_nok, delivery_days, start_date, end_date, notes, updated_at")
      .eq("company_id", company_id)
      .eq("status", "ACTIVE");

    if (beforeActive.error) return jsonErr(rid, "Kunne ikke lese eksisterende ACTIVE.", 500, { code: "AGREEMENT_READ_FAILED", detail: beforeActive.error });

    // Hvis status=ACTIVE: pause eksisterende ACTIVE først (kontrollert)
    let pausedActiveIds: string[] = [];
    if (status === "ACTIVE") {
      const pause = await admin
        .from("company_agreements")
        .update({ status: "PAUSED", updated_at: new Date().toISOString(), updated_by: scope.user_id ?? null } as any)
        .eq("company_id", company_id)
        .eq("status", "ACTIVE")
        .select("id");

      if (pause.error) return jsonErr(rid, "Kunne ikke pause eksisterende ACTIVE.", 500, { code: "PAUSE_ACTIVE_FAILED", detail: pause.error });
      pausedActiveIds = (pause.data ?? []).map((r: any) => String(r.id));
    }

    // Opprett ny avtale
    const ins = await admin
      .from("company_agreements")
      .insert({
        company_id,
        status,
        plan_tier,
        price_per_cuvert_nok,
        delivery_days,
        binding_months,
        notice_months,
        start_date,
        end_date,
        notes,
        created_by: scope.user_id ?? null,
        updated_by: scope.user_id ?? null,
      } as any)
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .single();

    if (ins.error) {
      return jsonErr(rid, "Kunne ikke opprette avtale.", 500, { code: "INSERT_FAILED", detail: ins.error });
    }

    // Hvis avtalen er ACTIVE: (valgfritt men anbefalt) hold companies.status i sync
    // (ikke kritisk hvis dere allerede har annen mekanikk)
    if (status === "ACTIVE" || status === "PAUSED" || status === "CLOSED") {
      const nextCompanyStatus = status === "ACTIVE" ? "ACTIVE" : status === "PAUSED" ? "PAUSED" : "CLOSED";
      await admin.from("companies").update({ status: nextCompanyStatus, updated_at: new Date().toISOString() } as any).eq("id", company_id);
    }

    // Audit (best-effort)
    const audit = await writeAuditEvent({
      scope,
      action: "agreement.create",
      entity_type: "company_agreement",
      entity_id: String((ins.data as any)?.id),
      summary: `Opprettet avtale (${status}) for ${company.data?.name ?? "company"} (${company_id})`,
      detail: {
        rid,
        company_id,
        company_name: company.data?.name ?? null,
        created: ins.data,
        paused_previous_active_ids: pausedActiveIds,
        before_active: beforeActive.data ?? [],
        request: {
          plan_tier,
          status,
          price_per_cuvert_nok,
          delivery_days,
          binding_months,
          notice_months,
          start_date,
          end_date,
          notes,
        },
      },
    });

    return jsonOk(rid, {
      agreement: ins.data,
      audit_ok: (audit as any)?.ok === true,
      audit_event: (audit as any)?.ok ? (audit as any).audit : null,
      audit_error: (audit as any)?.ok ? null : (audit as any)?.error ?? null,
    }, 200);
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(rid, String(e?.message ?? e), status, code);
  }
}

export async function GET(req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å opprette avtale.", 405, "METHOD_NOT_ALLOWED");
}

export async function PUT(req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å opprette avtale.", 405, "METHOD_NOT_ALLOWED");
}

export async function DELETE(req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å opprette avtale.", 405, "METHOD_NOT_ALLOWED");
}
