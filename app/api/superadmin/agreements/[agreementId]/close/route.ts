// app/api/superadmin/agreements/[agreementId]/close/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getScope, allowSuperadminOrCompanyAdmin } from "@/lib/auth/scope";
import { isUuid, safeText, isISODate } from "@/lib/agreements/normalize";
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
  return `sa_close_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// YYYY-MM-DD in Europe/Oslo without depending on other libs (safe for nodejs runtime)
function osloTodayISO(): string {
  // Use Intl to compute date parts in Europe/Oslo deterministically
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  const iso = `${y}-${m}-${d}`;
  return isISODate(iso) ? iso : new Date().toISOString().slice(0, 10);
}

type Ctx = { params: { agreementId: string } | Promise<{ agreementId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const rid = mkRid();

  try {
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    // ✅ Hard rule
    if (scope.role !== "superadmin") return jsonErr(403, rid, "FORBIDDEN", "Kun superadmin kan close avtale.");

    const params = await Promise.resolve(ctx.params as any);
    const agreementId = String(params?.agreementId ?? "").trim();
    if (!isUuid(agreementId)) return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig agreementId.");

    const admin = supabaseAdmin();

    // Before snapshot (for audit + idempotency)
    const before = await admin
      .from("company_agreements")
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .eq("id", agreementId)
      .maybeSingle();

    if (before.error) return jsonErr(500, rid, "READ_FAILED", "Kunne ikke lese avtale.", before.error);
    if (!before.data?.id) return jsonErr(404, rid, "NOT_FOUND", "Fant ikke avtale.");

    const companyId = String((before.data as any).company_id ?? "").trim();
    if (!isUuid(companyId)) {
      return jsonErr(500, rid, "DATA_INVALID", "Avtalen har ugyldig company_id.", { company_id: (before.data as any).company_id });
    }

    // Idempotency: already closed
    if (String((before.data as any).status) === "CLOSED") {
      // keep companies.status sync best-effort
      await admin.from("companies").update({ status: "CLOSED", updated_at: new Date().toISOString() } as any).eq("id", companyId);
      return jsonOk({ ok: true, rid, agreement: before.data, idempotent: true });
    }

    // Company name (best-effort for audit summary)
    const company = await admin.from("companies").select("id, name, status").eq("id", companyId).maybeSingle();
    if (company.error) return jsonErr(500, rid, "COMPANY_LOOKUP_FAILED", "Kunne ikke hente firma.", company.error);

    const todayOslo = osloTodayISO();

    // Close agreement: set CLOSED + end_date (if not set) to today
    const nextEndDate = (before.data as any).end_date && isISODate((before.data as any).end_date) ? (before.data as any).end_date : todayOslo;

    const upd = await admin
      .from("company_agreements")
      .update({
        status: "CLOSED",
        end_date: nextEndDate,
        updated_at: new Date().toISOString(),
        updated_by: scope.user_id ?? null,
      } as any)
      .eq("id", agreementId)
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, created_at, updated_at"
      )
      .single();

    if (upd.error) return jsonErr(500, rid, "CLOSE_FAILED", "Kunne ikke close avtale.", upd.error);

    // Keep companies.status in sync
    await admin.from("companies").update({ status: "CLOSED", updated_at: new Date().toISOString() } as any).eq("id", companyId);

    // Audit (best-effort)
    const audit = await writeAuditEvent({
      scope,
      action: "agreement.close",
      entity_type: "company_agreement",
      entity_id: agreementId,
      summary: `Satte avtale til CLOSED for ${safeText((company.data as any)?.name) ?? "company"} (${companyId})`,
      detail: {
        rid,
        company_id: companyId,
        company_name: safeText((company.data as any)?.name),
        end_date_set: nextEndDate,
        before: before.data,
        after: upd.data,
      },
    });

    return jsonOk({
      ok: true,
      rid,
      agreement: upd.data,
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
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST for å close avtale.");
}

export async function PUT() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST for å close avtale.");
}

export async function DELETE() {
  return jsonErr(405, "method_not_allowed", "METHOD_NOT_ALLOWED", "Bruk POST for å close avtale.");
}
