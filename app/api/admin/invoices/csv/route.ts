// app/api/admin/invoices/csv/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { defaultInvoiceWindowISO, isIsoDate } from "@/lib/billing/period";
import { toCsv, type InvoiceRow } from "@/lib/billing/csv";
import { normalizeAgreement, isAgreementInvalid, resolveTierForDate, type AgreementNormalized } from "@/lib/agreements/normalizeAgreement";
import { PRICE_PER_TIER, type PlanTier } from "@/lib/pricing/priceForDate";

/* =========================================================
   Responses
========================================================= */

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

/* =========================================================
   Types
========================================================= */

type CompanyRow = {
  id: string;
  name: string | null;
};

type AgreementRow = any; // company_current_agreement-row (DB shape kan variere)

/* =========================================================
   Helpers
========================================================= */

function asPlanTier(v: any): PlanTier | null {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "BASIS" || s === "LUXUS") return s as PlanTier;
  return null;
}

/* =========================================================
   GET
========================================================= */

export async function GET(req: Request) {
  // 1) Auth (cookie-session)
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) return jsonError(401, "unauthorized", "Ikke innlogget");

  const role = String(user.user_metadata?.role ?? "").toLowerCase();
  const companyId = String(user.user_metadata?.company_id ?? "").trim();

  if (role !== "company_admin") return jsonError(403, "forbidden", "Ingen tilgang");
  if (!companyId) return jsonError(400, "missing_company_id", "Mangler company_id på profilen");

  // 2) Period
  const url = new URL(req.url);
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");

  const def = defaultInvoiceWindowISO();
  const from = isIsoDate(qFrom) ? qFrom! : def.from;
  const to = isIsoDate(qTo) ? qTo! : def.to;

  if (from >= to) return jsonError(400, "bad_range", "Ugyldig periode", { from, to });

  const admin = supabaseAdmin();

  // 3) Company
  const cRes = await admin.from("companies").select("id,name").eq("id", companyId).maybeSingle();
  if (cRes.error) return jsonError(500, "db_error", "Kunne ikke hente firma", cRes.error);

  const company = (cRes.data ?? null) as CompanyRow | null;
  if (!company) return jsonError(404, "not_found", "Fant ikke firma");

  const companyName = String(company.name ?? "—");

  // 4) Agreement (ONE truth): company_current_agreement
  const aRes = await admin.from("company_current_agreement").select("*").eq("company_id", companyId).maybeSingle();
  if (aRes.error) return jsonError(500, "db_error", "Kunne ikke hente avtale", aRes.error);
  if (!aRes.data) return jsonError(409, "no_agreement", "Ingen avtale funnet for firma");

  const agreementRes = normalizeAgreement(aRes.data as AgreementRow);
  if (isAgreementInvalid(agreementRes)) {
    return jsonError(409, "agreement_invalid", "Avtalen er ugyldig eller mangler ukesplan", {
      code: agreementRes.error,
      message: agreementRes.message,
      detail: agreementRes.detail ?? null,
    });
  }

  const agreement: AgreementNormalized = agreementRes;

  // 5) Locations (navn for CSV)
  const locRes = await admin.from("company_locations").select("id,name").eq("company_id", companyId);
  if (locRes.error) return jsonError(500, "db_error", "Kunne ikke hente lokasjoner", locRes.error);

  const locMap = new Map<string, string>();
  for (const l of locRes.data ?? []) locMap.set(String((l as any).id), String((l as any).name ?? ""));

  // 6) Orders in window (ACTIVE)
  const oRes = await admin
    .from("orders")
    .select("date,location_id,slot,status")
    .eq("company_id", companyId)
    .gte("date", from)
    .lt("date", to)
    .eq("status", "ACTIVE");

  if (oRes.error) return jsonError(500, "db_error", "Kunne ikke hente ordre", oRes.error);

  // 7) Group: date + location + slot + tier
  const buckets = new Map<
    string,
    { date: string; location_id: string | null; slot: string | null; tier: PlanTier; unit: number; qty: number }
  >();

  for (const o of oRes.data ?? []) {
    const dateISO = String((o as any).date);

    // Resolve tier for that date (Man–Fre). Helg skal feile (fasit).
    let tierRaw: any;
    try {
      tierRaw = resolveTierForDate(agreement, dateISO);
    } catch (e: any) {
      return jsonError(409, "weekend_not_supported", "Helg støttes ikke i fakturagrunnlag (Man–Fre)", {
        date: dateISO,
        message: String(e?.message ?? e),
      });
    }

    const tier = asPlanTier(tierRaw);
    if (!tier) {
      return jsonError(409, "bad_tier", "Kunne ikke løse plan-tier for dato (forventer BASIS/LUXUS)", {
        date: dateISO,
        tier: tierRaw,
      });
    }

    const unit = PRICE_PER_TIER[tier];

    const location_id = (o as any).location_id ? String((o as any).location_id) : null;
    const slot = (o as any).slot ? String((o as any).slot) : null;

    const key = [dateISO, location_id ?? "", slot ?? "", tier].join("|");
    const cur = buckets.get(key);

    if (cur) cur.qty += 1;
    else buckets.set(key, { date: dateISO, location_id, slot, tier, unit, qty: 1 });
  }

  // 8) Rows -> CSV
  const rows: InvoiceRow[] = Array.from(buckets.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => {
      const unit = Number(b.unit) || 0;
      return {
        company_id: companyId,
        company_name: companyName,
        location_id: b.location_id,
        location_name: b.location_id ? locMap.get(b.location_id) ?? null : null,
        date: b.date,
        slot: b.slot,
        // CSV feltet heter plan_tier – her betyr det "tier for den datoen"
        plan_tier: b.tier as any,
        qty: b.qty,
        unit_price_nok: unit,
        amount_nok: unit * b.qty,
      };
    });

  const csv = toCsv(rows);
  return csvResponse(csv, `invoice_${companyId}_${from}_to_${to}.csv`);
}
