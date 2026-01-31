// app/api/admin/invoices/csv/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { defaultInvoiceWindowISO, isIsoDate } from "@/lib/billing/period";
import { normalizeAgreement, isAgreementInvalid, resolveTierForDate, type AgreementNormalized } from "@/lib/agreements/normalizeAgreement";
import { PRICE_PER_TIER, type PlanTier } from "@/lib/pricing/priceForDate";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonErr } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

type CompanyRow = { id: string; name: string | null };
type AgreementRow = any;

type InvoiceLine = {
  date: string;
  location_id: string | null;
  location_name: string | null;
  slot: string | null;
  plan_tier: PlanTier;
  qty: number;
  unit_price_nok: number;
  amount_nok: number;
};

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

function csvEscape(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(values: unknown[]) {
  return values.map(csvEscape).join(",");
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.invoices.csv", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler companyId i scope.");

  try {
    // Period
    const url = new URL(req.url);
    const qFrom = url.searchParams.get("from");
    const qTo = url.searchParams.get("to");

    const def = defaultInvoiceWindowISO();
    const from = isIsoDate(qFrom) ? qFrom! : def.from;
    const to = isIsoDate(qTo) ? qTo! : def.to;

    if (from >= to) return jsonErr(400, rid, "BAD_RANGE", "Ugyldig periode.", { from, to });

    const admin = supabaseAdmin();

    // Company
    const cRes = await admin.from("companies").select("id,name").eq("id", companyId).maybeSingle();
    if (cRes.error) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente firma.", asErrDetail(cRes.error));

    const company = (cRes.data ?? null) as CompanyRow | null;
    if (!company) return jsonErr(404, rid, "NOT_FOUND", "Fant ikke firma.");

    const companyName = safeStr(company.name) || "—";

    // Agreement (ONE truth): company_current_agreement
    const aRes = await admin.from("company_current_agreement").select("*").eq("company_id", companyId).maybeSingle();
    if (aRes.error) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente avtale.", asErrDetail(aRes.error));
    if (!aRes.data) return jsonErr(404, rid, "NO_AGREEMENT", "Ingen avtale funnet for firma.");

    const agreementRes = normalizeAgreement(aRes.data as AgreementRow);
    if (isAgreementInvalid(agreementRes)) {
      return jsonErr(409, rid, "AGREEMENT_INVALID", "Avtalen er ugyldig eller mangler ukesplan.", {
        code: (agreementRes as any).error,
        message: (agreementRes as any).message,
        detail: (agreementRes as any).detail ?? null,
      });
    }
    const agreement: AgreementNormalized = agreementRes as AgreementNormalized;

    // Locations (navn for CSV)
    const locRes = await admin.from("company_locations").select("id,name").eq("company_id", companyId);
    if (locRes.error) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente lokasjoner.", asErrDetail(locRes.error));

    const locMap = new Map<string, string>();
    for (const l of locRes.data ?? []) locMap.set(String((l as any).id), safeStr((l as any).name));

    // Orders in window (ACTIVE)
    const oRes = await admin
      .from("orders")
      .select("date,location_id,slot,status")
      .eq("company_id", companyId)
      .gte("date", from)
      .lt("date", to)
      .eq("status", "ACTIVE");

    if (oRes.error) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente ordre.", asErrDetail(oRes.error));

    // Group: date + location + slot + tier
    const buckets = new Map<string, { date: string; location_id: string | null; slot: string | null; tier: PlanTier; unit: number; qty: number }>();

    for (const o of oRes.data ?? []) {
      const dateISO = safeStr((o as any).date);
      if (!dateISO) continue;

      let tierRaw: any = null;
      try {
        tierRaw = resolveTierForDate(agreement, dateISO);
      } catch (e: any) {
        return jsonErr(409, rid, "WEEKEND_NOT_SUPPORTED", "Helg støttes ikke i fakturagrunnlag (Man–Fre).", {
          date: dateISO,
          message: safeStr(e?.message ?? e),
        });
      }

      const tier = asPlanTier(tierRaw);
      if (!tier) {
        return jsonErr(500, rid, "BAD_TIER", "Kunne ikke løse plan-tier for dato (forventer BASIS/LUXUS).", {
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

    const lines: InvoiceLine[] = Array.from(buckets.values())
      .sort((x, y) => x.date.localeCompare(y.date))
      .map((b) => {
        const unit = Number(b.unit) || 0;
        const amount = unit * b.qty;
        return {
          date: b.date,
          location_id: b.location_id,
          location_name: b.location_id ? locMap.get(b.location_id) ?? null : null,
          slot: b.slot,
          plan_tier: b.tier,
          qty: b.qty,
          unit_price_nok: unit,
          amount_nok: amount,
        };
      });

    const header = ["company_id", "company_name", "from", "to_exclusive", "date", "location_id", "location_name", "slot", "plan_tier", "qty", "unit_price_nok", "amount_nok"];
    const rows: string[] = [];
    rows.push(header.join(","));

    for (const r of lines) {
      rows.push(
        csvLine([
          companyId,
          companyName,
          from,
          to,
          r.date,
          r.location_id ?? "",
          r.location_name ?? "",
          r.slot ?? "",
          r.plan_tier,
          r.qty,
          r.unit_price_nok,
          r.amount_nok,
        ])
      );
    }

    const csv = rows.join("\n");
    const filename = `invoice_lines_${companyId}_${from}_to_${to}.csv`;

    const headers = {
      ...noStoreHeaders(),
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-lp-rid": rid,
    } as Record<string, string>;

    return new Response(csv, { status: 200, headers });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");

    const headers = {
      ...noStoreHeaders(),
      "content-type": "application/json; charset=utf-8",
      "x-lp-rid": rid,
    } as Record<string, string>;

    return new Response(JSON.stringify({ ok: false, rid, error: code, message: "Uventet feil.", detail: asErrDetail(e) }), {
      status,
      headers,
    });
  }
}


