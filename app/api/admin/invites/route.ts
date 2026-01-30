// app/api/admin/invoices/csv/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { defaultInvoiceWindowISO, isIsoDate } from "@/lib/billing/period";
import { toCsv, type InvoiceRow } from "@/lib/billing/csv";
import {
  normalizeAgreement,
  isAgreementInvalid,
  resolveTierForDate,
  type AgreementNormalized,
} from "@/lib/agreements/normalizeAgreement";
import { PRICE_PER_TIER, type PlanTier } from "@/lib/pricing/priceForDate";

// ✅ Dag-10 helpers
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { jsonErr, rid as makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";

/* =========================================================
   Types
========================================================= */

type CompanyRow = {
  id: string;
  name: string | null;
};

type AgreementRow = any;

/* =========================================================
   Helpers
========================================================= */

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function asPlanTier(v: any): PlanTier | null {
  const s = String(v ?? "").toUpperCase().trim();
  if (s === "BASIS" || s === "LUXUS") return s as PlanTier;
  return null;
}

function asErrDetail(e: any) {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (e instanceof Error) return { name: e.name, message: e.message };
  try {
    return JSON.parse(JSON.stringify(e));
  } catch {
    return String(e);
  }
}

function csvResponse(csv: string, filename: string, rid: string) {
  const headers = {
    ...noStoreHeaders(),
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "x-lp-rid": rid,
  } as Record<string, string>;

  return new Response(csv, { status: 200, headers });
}

/* =========================================================
   GET
========================================================= */

export async function GET(req: NextRequest) {
  const rid = makeRid();
  const ctx = { rid } as any; // for jsonErr(ctx, ...)

  // 1) Scope + role + company scope
  const a = await scopeOr401(req);
  if (a instanceof Response) return a;
  const authed = a.ctx;

  const denyRole = requireRoleOr403(authed, "admin.invoices.csv", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(authed);
  if (denyScope) return denyScope;

  const companyId = safeStr(authed?.scope?.companyId);
  if (!companyId) return jsonErr(ctx, "bad_request", "Mangler companyId i scope.", null);

  // 2) Period
  const url = new URL(req.url);
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");

  const def = defaultInvoiceWindowISO();
  const from = isIsoDate(qFrom) ? qFrom! : def.from;
  const to = isIsoDate(qTo) ? qTo! : def.to;

  if (from >= to) return jsonErr(ctx, "bad_range", "Ugyldig periode", { from, to });

  const admin = supabaseAdmin();

  // 3) Company
  const cRes = await admin.from("companies").select("id,name").eq("id", companyId).maybeSingle();
  if (cRes.error) return jsonErr(ctx, "db_error", "Kunne ikke hente firma", asErrDetail(cRes.error));

  const company = (cRes.data ?? null) as CompanyRow | null;
  if (!company) return jsonErr(ctx, "not_found", "Fant ikke firma");

  const companyName = safeStr(company.name) || "—";

  // 4) Agreement
  const aRes = await admin.from("company_current_agreement").select("*").eq("company_id", companyId).maybeSingle();
  if (aRes.error) return jsonErr(ctx, "db_error", "Kunne ikke hente avtale", asErrDetail(aRes.error));
  if (!aRes.data) return jsonErr(ctx, "no_agreement", "Ingen avtale funnet for firma");

  const agreementRes = normalizeAgreement(aRes.data as AgreementRow);
  if (isAgreementInvalid(agreementRes)) {
    return jsonErr(ctx, "agreement_invalid", "Avtalen er ugyldig eller mangler ukesplan", {
      code: (agreementRes as any).error,
      message: (agreementRes as any).message,
      detail: (agreementRes as any).detail ?? null,
    });
  }

  const agreement: AgreementNormalized = agreementRes as AgreementNormalized;

  // 5) Locations (navn for CSV)
  const locRes = await admin.from("company_locations").select("id,name").eq("company_id", companyId);
  if (locRes.error) return jsonErr(ctx, "db_error", "Kunne ikke hente lokasjoner", asErrDetail(locRes.error));

  const locMap = new Map<string, string>();
  for (const l of locRes.data ?? []) locMap.set(String((l as any).id), safeStr((l as any).name));

  // 6) Orders in window (ACTIVE)
  const oRes = await admin
    .from("orders")
    .select("date,location_id,slot,status")
    .eq("company_id", companyId)
    .gte("date", from)
    .lt("date", to)
    .eq("status", "ACTIVE");

  if (oRes.error) return jsonErr(ctx, "db_error", "Kunne ikke hente ordre", asErrDetail(oRes.error));

  // 7) Group: date + location + slot + tier
  const buckets = new Map<
    string,
    { date: string; location_id: string | null; slot: string | null; tier: PlanTier; unit: number; qty: number }
  >();

  for (const o of oRes.data ?? []) {
    const dateISO = safeStr((o as any).date);
    if (!dateISO) continue;

    let tierRaw: any = null;
    try {
      tierRaw = resolveTierForDate(agreement, dateISO);
    } catch (e: any) {
      return jsonErr(ctx, "weekend_not_supported", "Helg støttes ikke i fakturagrunnlag (Man–Fre)", {
        date: dateISO,
        message: safeStr(e?.message ?? e),
      });
    }

    const tier = asPlanTier(tierRaw);
    if (!tier) {
      return jsonErr(ctx, "bad_tier", "Kunne ikke løse plan-tier for dato (forventer BASIS/LUXUS)", {
        date: dateISO,
        tier: tierRaw,
      });
    }

    const unit = Number(PRICE_PER_TIER[tier] ?? 0);

    const location_id = (o as any).location_id ? safeStr((o as any).location_id) : null;
    const slot = (o as any).slot ? safeStr((o as any).slot) : null;

    const key = [dateISO, location_id ?? "", slot ?? "", tier].join("|");
    const cur = buckets.get(key);

    if (cur) cur.qty += 1;
    else buckets.set(key, { date: dateISO, location_id, slot, tier, unit, qty: 1 });
  }

  // 8) Rows -> CSV
  const rows: InvoiceRow[] = Array.from(buckets.values())
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((b) => {
      const unit = Number(b.unit) || 0;
      return {
        company_id: companyId,
        company_name: companyName,
        location_id: b.location_id,
        location_name: b.location_id ? locMap.get(b.location_id) ?? null : null,
        date: b.date,
        slot: b.slot,
        plan_tier: b.tier as any,
        qty: b.qty,
        unit_price_nok: unit,
        amount_nok: unit * b.qty,
      };
    });

  const csv = toCsv(rows);
  return csvResponse(csv, `invoice_${companyId}_${from}_to_${to}.csv`, rid);
}
