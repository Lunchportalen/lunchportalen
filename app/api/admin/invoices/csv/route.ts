// app/api/admin/invoices/csv/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";
import type { NextRequest } from "next/server";

import { defaultInvoiceWindowISO, isIsoDate } from "@/lib/billing/period";
import {
  normalizeAgreement,
  isAgreementInvalid,
  resolveTierForDate,
  type AgreementNormalized,
} from "@/lib/agreements/normalizeAgreement";
import { PRICE_PER_TIER, type PlanTier } from "@/lib/pricing/priceForDate";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

type CompanyRow = { id: string; name: string | null };
type AgreementRow = Record<string, any>;

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

/**
 * Agreement lookup strategy:
 * 0) If scope.locationId is present, try ACTIVE agreement for that company_location_id
 * 1) Prefer latest ACTIVE row in agreements (direct truth)
 * 2) Fallback to company_current_agreement view (legacy)
 *
 * NOTE: robust in both production and tests:
 * - Swallows missing chain methods or missing view in mocks
 */
async function loadAgreementRow(admin: any, companyId: string, companyLocationHint?: string | null) {
  // 0) Try match by company_location_id (if provided)
  if (companyLocationHint) {
    try {
      const aLoc = await admin
        .from("agreements")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "ACTIVE")
        .eq("company_location_id", companyLocationHint)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (aLoc?.error) {
        // ignore and continue
      } else if (aLoc?.data) {
        return {
          ok: true as const,
          src: "agreements(company_location_id)" as const,
          error: null,
          data: aLoc.data as AgreementRow,
        };
      }
    } catch {
      // swallow
    }
  }

  // 1) Prefer agreements table
  try {
    const aTbl = await admin
      .from("agreements")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (aTbl?.error) {
      return { ok: false as const, src: "agreements" as const, error: aTbl.error, data: null };
    }
    if (aTbl?.data) {
      return { ok: true as const, src: "agreements" as const, error: null, data: aTbl.data as AgreementRow };
    }
  } catch {
    // swallow and fallback
  }

  // 2) Fallback view (legacy)
  try {
    const aView = await admin
      .from("company_current_agreement")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (aView?.error) {
      return { ok: false as const, src: "company_current_agreement" as const, error: aView.error, data: null };
    }

    return {
      ok: true as const,
      src: "company_current_agreement" as const,
      error: null,
      data: (aView?.data ?? null) as AgreementRow | null,
    };
  } catch (e: any) {
    // If view doesn't exist or mocks don't support it, return null (handled by NO_AGREEMENT)
    return {
      ok: true as const,
      src: "company_current_agreement" as const,
      error: null,
      data: null,
    };
  }
}

function summarizeAgreementRow(row: AgreementRow | null) {
  if (!row) return null;
  const weekplan = (row as any).weekplan ?? null;
  return {
    id: (row as any).id ?? null,
    company_id: (row as any).company_id ?? null,
    status: (row as any).status ?? null,
    start_date: (row as any).start_date ?? null,
    end_date: (row as any).end_date ?? null,
    company_location_id: (row as any).company_location_id ?? null,
    location_id: (row as any).location_id ?? null,
    tier: (row as any).tier ?? null,
    price_ex_vat: (row as any).price_ex_vat ?? null,
    has_weekplan: !!weekplan,
    weekplan_keys: weekplan && typeof weekplan === "object" ? Object.keys(weekplan) : null,
  };
}

export async function GET(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const rid = makeRid();
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const denyRole = requireRoleOr403(a.ctx, "admin.invoices.csv", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const { scope } = a.ctx;
  const companyId = safeStr(scope.companyId);
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  try {
    // Period
    const url = new URL(req.url);
    const qFrom = url.searchParams.get("from");
    const qTo = url.searchParams.get("to");
    const metaOnly = url.searchParams.get("meta") === "1";

    const def = defaultInvoiceWindowISO();
    const from = isIsoDate(qFrom) ? qFrom! : def.from;
    const to = isIsoDate(qTo) ? qTo! : def.to;

    if (from >= to) {
      return jsonErr(rid, "Ugyldig periode.", 400, { code: "BAD_RANGE", detail: { from, to } });
    }

    const admin = supabaseAdmin();

    // --- Optional diagnostics for meta=1 (helps prove service-role visibility) ---
    if (metaOnly) {
      const diag = await admin
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "ACTIVE");

      // Still continue normally below; but include diag in meta response later
      // (we store it in closure variables)
      (globalThis as any).__lp_diag = {
        hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        agreementsCount: (diag as any).count ?? null,
        agreementsHeadError: diag.error ? asErrDetail(diag.error) : null,
      };
    }

    // Company
    const cRes = await admin.from("companies").select("id,name").eq("id", companyId).maybeSingle();
    if (cRes.error) {
      return jsonErr(rid, "Kunne ikke hente firma.", 500, { code: "DB_ERROR", detail: asErrDetail(cRes.error) });
    }

    const company = (cRes.data ?? null) as CompanyRow | null;
    if (!company) return jsonErr(rid, "Fant ikke firma.", 404, "NOT_FOUND");

    const companyName = safeStr(company.name) || "—";

    // Agreement
    const companyLocationHint = safeStr((scope as any).locationId) || null;
    const ag = await loadAgreementRow(admin, companyId, companyLocationHint);

    if (ag.ok === false) {
      return jsonErr(rid, "Kunne ikke hente avtale.", 500, {
        code: "DB_ERROR",
        detail: { source: ag.src, error: asErrDetail(ag.error) },
      });
    }
    if (!ag.data) return jsonErr(rid, "Ingen avtale funnet for firma.", 404, "NO_AGREEMENT");

    const agreementRes = normalizeAgreement(ag.data as AgreementRow);
    if (isAgreementInvalid(agreementRes)) {
      return jsonErr(rid, "Avtalen er ugyldig eller mangler ukesplan.", 409, {
        code: "AGREEMENT_INVALID",
        detail: {
          source: ag.src,
          normalized_error: (agreementRes as any).error,
          normalized_message: (agreementRes as any).message,
          normalized_detail: (agreementRes as any).detail ?? null,
          received_agreement: summarizeAgreementRow(ag.data),
          received_keys: Object.keys(ag.data ?? {}),
        },
      });
    }
    const agreement: AgreementNormalized = agreementRes as AgreementNormalized;

    // Locations (navn for CSV) — expects orders.location_id == company_locations.id
    const locRes = await admin.from("company_locations").select("id,name").eq("company_id", companyId);
    if (locRes.error) {
      return jsonErr(rid, "Kunne ikke hente lokasjoner.", 500, {
        code: "DB_ERROR",
        detail: asErrDetail(locRes.error),
      });
    }

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

    if (oRes.error) {
      return jsonErr(rid, "Kunne ikke hente ordre.", 500, { code: "DB_ERROR", detail: asErrDetail(oRes.error) });
    }

    // Group: date + location + slot + tier
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
        return jsonErr(rid, "Helg støttes ikke i fakturagrunnlag (Man–Fre).", 409, {
          code: "WEEKEND_NOT_SUPPORTED",
          detail: { date: dateISO, message: safeStr(e?.message ?? e) },
        });
      }

      const tier = asPlanTier(tierRaw);
      if (!tier) {
        return jsonErr(rid, "Kunne ikke løse plan-tier for dato (forventer BASIS/LUXUS).", 500, {
          code: "BAD_TIER",
          detail: { date: dateISO, tier: tierRaw },
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

    const header = [
      "company_id",
      "company_name",
      "from",
      "to_exclusive",
      "date",
      "location_id",
      "location_name",
      "slot",
      "plan_tier",
      "qty",
      "unit_price_nok",
      "amount_nok",
    ];

    if (metaOnly) {
      const diag = (globalThis as any).__lp_diag ?? null;
      return jsonOk(
        rid,
        {
          filename: `invoice_lines_${companyId}_${from}_to_${to}.csv`,
          contentType: "text/csv; charset=utf-8",
          rows: lines.length,
          agreement_source: ag.src,
          scope: { companyId, locationId: companyLocationHint },
          agreement_row: summarizeAgreementRow(ag.data),
          diag,
        },
        200
      );
    }

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

    const filename = `invoice_lines_${companyId}_${from}_to_${to}.csv`;
    const contentType = "text/csv; charset=utf-8";
    const contentDisposition = `attachment; filename="${filename}"`;

    const csv = rows.join("\n");

    const headers = {
      ...noStoreHeaders(),
      "content-type": contentType,
      "content-disposition": contentDisposition,
      "x-lp-rid": rid,
    } as Record<string, string>;

    return new Response(csv, { status: 200, headers });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(rid, "Uventet feil.", status, { code, detail: asErrDetail(e) });
  }
}
