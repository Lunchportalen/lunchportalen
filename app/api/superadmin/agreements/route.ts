// app/api/superadmin/agreements/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { getScope, allowSuperadminOrCompanyAdmin } from "@/lib/auth/scope";
import {
  type AgreementStatus,
  type Tier,
  normalizeDeliveryDays,
  normalizeStatus,
  normalizeTier,
  isUuid,
  intOr,
  isoDateOrToday,
  safeText,
  isISODate,
} from "@/lib/agreements/normalize";
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

function mkRid() {
  return `sa_agreements_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

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
  const rid = mkRid();

  try {
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    // ✅ Hard rule
    if (scope.role !== "superadmin") {
      return jsonErr(403, rid, "FORBIDDEN", "Kun superadmin kan opprette avtale.");
    }

    const body = (await req.json().catch(() => null)) as Partial<CreateBody> | null;
    if (!body) return jsonErr(400, rid, "BAD_REQUEST", "Mangler JSON body.");

    const company_id = String(body.company_id ?? "").trim();
    if (!isUuid(company_id)) return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig company_id.");

    const plan_tier: Tier = normalizeTier(body.plan_tier);
    const status: AgreementStatus = normalizeStatus(body.status ?? "DRAFT");

    // Pris: default 90/130 hvis ikke sendt, men må alltid være > 0
    const defaultPrice = plan_tier === "LUXUS" ? 130 : 90;
    const price_per_cuvert_nok =
      Number.isFinite(Number(body.price_per_cuvert_nok)) ? intOr(body.price_per_cuvert_nok, defaultPrice) : defaultPrice;

    if (!Number.isFinite(price_per_cuvert_nok) || price_per_cuvert_nok <= 0) {
      return jsonErr(400, rid, "BAD_REQUEST", "price_per_cuvert_nok må være > 0.");
    }

    const delivery_days = normalizeDeliveryDays(body.delivery_days);
    const binding_months = clampNonNegInt(body.binding_months, 12);
    const notice_months = clampNonNegInt(body.notice_months, 3);
    const start_date = isoDateOrToday(body.start_date);

    const end_date_raw = body.end_date ?? null;
    const end_date = end_date_raw === null ? null : asISODateOrNull(end_date_raw);
    if (end_date_raw != null && end_date == null) {
      return jsonErr(400, rid, "BAD_REQUEST", "end_date må være YYYY-MM-DD eller null.");
    }

    // (valgfritt) sanity: end_date kan ikke være før start_date
    if (end_date && isISODate(start_date) && end_date < start_date) {
      return jsonErr(400, rid, "BAD_REQUEST", "end_date kan ikke være før start_date.", { start_date, end_date });
    }

    const notes = safeText(body.notes) ?? null;

    const admin = supabaseAdmin();

    // Sikre at company finnes (bedre feilmelding enn FK)
    const company = await admin.from("companies").select("id, name, status").eq("id", company_id).maybeSingle();
    if (company.error) return jsonErr(500, rid, "COMPANY_LOOKUP_FAILED", "Kunne ikke hente firma.", company.error);
    if (!company.data?.id) return jsonErr(404, rid, "NOT_FOUND", "Fant ikke firma.");

    // Snapshot: eksisterende ACTIVE før vi evt pauser (for audit)
    const beforeActive = await admin
      .from("company_agreements")
      .select("id, status, plan_tier, price_per_cuvert_nok, delivery_days, start_date, end_date, notes, updated_at")
      .eq("company_id", company_id)
      .eq("status", "ACTIVE");

    if (beforeActive.error) return jsonErr(500, rid, "AGREEMENT_READ_FAILED", "Kunne ikke lese eksisterende ACTIVE.", beforeActive.error);

    // Hvis status=ACTIVE: pause eksisterende ACTIVE først (kontrollert)
    let pausedActiveIds: string[] = [];
    if (status === "ACTIVE") {
      const pause = await admin
        .from("company_agreements")
        .update({ status: "PAUSED", updated_at: new Date().toISOString(), updated_by: scope.user_id ?? null } as any)
        .eq("company_id", company_id)
        .eq("status", "ACTIVE")
        .select("id");

      if (pause.error) return jsonErr(500, rid, "PAUSE_ACTIVE_FAILED", "Kunne ikke pause eksisterende ACTIVE.", pause.error);
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
      return jsonErr(500, rid, "INSERT_FAILED", "Kunne ikke opprette avtale.", ins.error);
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

    return jsonOk({
      ok: true,
      rid,
      agreement: ins.data,
      audit_ok: (audit as any)?.ok === true,
      audit_event: (audit as any)?.ok ? (audit as any).audit : null,
      audit_error: (audit as any)?.ok ? null : (audit as any)?.error ?? null,
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(status, rid, code, String(e?.message ?? e));
  }
}

export async function GET() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST for å opprette avtale.");
}

export async function PUT() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST for å opprette avtale.");
}

export async function DELETE() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST for å opprette avtale.");
}



