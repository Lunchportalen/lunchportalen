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

function summarizeAgreementRow(row: AgreementRow | null) {
  if (!row) return null;
  const weekplan = (row as any).weekplan ?? null;
  return {
    id: (row as any).id ?? null,
    company_id: (row as any).company_id ?? null,
    status: (row as any).status ?? null,
    company_location_id: (row as any).company_location_id ?? null,
    location_id: (row as any).location_id ?? null,
    tier: (row as any).tier ?? null,
    start_date: (row as any).start_date ?? null,
    end_date: (row as any).end_date ?? null,
    has_weekplan: !!weekplan,
    weekplan_keys: weekplan && typeof weekplan === "object" ? Object.keys(weekplan) : null,
  };
}

const CSV_HEADER = [
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
] as const;

function buildFilename(companyId: string, from: string, to: string) {
  return `invoice_lines_${companyId}_${from}_to_${to}.csv`;
}

/**
 * Always-OK CSV response for "no data / not ready / unsupported" situations.
 * This eliminates 409 noise for CSV downloads and keeps clients simple.
 */
function emptyCsvResponse(opts: {
  rid: string;
  filename: string;
  reason: string;
  detail?: any;
}) {
  const headers: Record<string, string> = {
    ...noStoreHeaders(),
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${opts.filename}"`,
    "x-lp-rid": opts.rid,
    "x-lp-empty-reason": opts.reason,
  };

  // Optional: add compact, safe diagnostic detail (kept short to avoid huge headers)
  if (opts.detail !== undefined) {
    try {
      const raw = JSON.stringify(opts.detail);
      headers["x-lp-empty-detail"] = encodeURIComponent(raw).slice(0, 1500);
    } catch {
      // ignore
    }
  }

  return new Response(CSV_HEADER.join(",") + "\n", { status: 200, headers });
}

/**
 * Ã¢Å“â€¦ Definitive agreement lookup:
 * - Use agreements table ONLY (direct truth)
 * - No dependency on company_current_agreement (stale/missing in prod)
 */
async function loadAgreementRow(admin: any, companyId: string) {
  try {
    const a = await admin
      .from("agreements")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "ACTIVE")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (a?.error) {
      return { ok: false as const, src: "agreements" as const, error: a.error, data: null };
    }

    return {
      ok: true as const,
      src: "agreements" as const,
      error: null,
      data: (a?.data ?? null) as AgreementRow | null,
    };
  } catch (e: any) {
    return { ok: false as const, src: "agreements" as const, error: e, data: null };
  }
}

export async function GET(req: NextRequest) {
  const { supabaseAdmin, hasSupabaseAdminConfig } = await import("@/lib/supabase/admin");

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

  const url = new URL(req.url);
  const metaOnly = url.searchParams.get("meta") === "1";
  const ts = safeStr(url.searchParams.get("ts"));

  // Period
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");
  const def = defaultInvoiceWindowISO();
  const from = isIsoDate(qFrom) ? qFrom! : def.from;
  const to = isIsoDate(qTo) ? qTo! : def.to;

  if (from >= to) {
    return jsonErr(rid, "Ugyldig periode.", 400, { code: "BAD_RANGE", detail: { from, to } });
  }

  const filename = buildFilename(companyId, from, to);

  try {
    const admin = supabaseAdmin();
    const companyLocationId = safeStr((scope as any).locationId) || null;

    // Visibility check (meta diagnostics)
    const vis = await admin
      .from("agreements")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "ACTIVE");

    const diag = {
      buildTag: "CSV_ROUTE_DIAG_V3_ALWAYS200_EMPTY",
      rid,
      ts: ts || null,
      scope: { companyId, locationId: companyLocationId, role: (scope as any).role ?? null },
      hasAdminConfig: hasSupabaseAdminConfig(),
      agreementsVisibleCount: (vis as any).count ?? null,
      agreementsVisibleError: vis.error ? asErrDetail(vis.error) : null,
      range: { from, to },
      supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    };

    // Company (for meta + csv)
    const cRes = await admin.from("companies").select("id,name").eq("id", companyId).maybeSingle();
    const company = (cRes.data ?? null) as CompanyRow | null;

    // Agreement
    const ag = await loadAgreementRow(admin, companyId);

    if (metaOnly) {
      return jsonOk(
        rid,
        {
          ...diag,
          company: company ? { id: company.id, name: safeStr(company.name) || "Ã¢â‚¬â€" } : null,
          agreement_source: ag.src,
          agreement_row: summarizeAgreementRow(ag.data ?? null),
          agreement_lookup_error: ag.ok === false ? asErrDetail(ag.error) : null,
        },
        200
      );
    }

    if (cRes.error) {
      return jsonErr(rid, "Kunne ikke hente firma.", 500, { code: "DB_ERROR", detail: asErrDetail(cRes.error) });
    }
    if (!company) return jsonErr(rid, "Fant ikke firma.", 404, "NOT_FOUND");

    if (ag.ok === false) {
      return jsonErr(rid, "Kunne ikke hente avtale.", 500, { code: "DB_ERROR", detail: asErrDetail(ag.error) });
    }

    // Ã¢Å“â€¦ CSV should not error when agreement is missing: return empty CSV
    if (!ag.data) {
      return emptyCsvResponse({
        rid,
        filename,
        reason: "NO_AGREEMENT",
        detail: { companyId, range: { from, to } },
      });
    }

    const agreementRes = normalizeAgreement(ag.data as AgreementRow);

    // Ã¢Å“â€¦ CSV should not error when agreement invalid: return empty CSV
    if (isAgreementInvalid(agreementRes)) {
      return emptyCsvResponse({
        rid,
        filename,
        reason: "AGREEMENT_INVALID",
        detail: {
          normalized_error: (agreementRes as any).error,
          normalized_message: (agreementRes as any).message,
          normalized_detail: (agreementRes as any).detail ?? null,
          received_agreement: summarizeAgreementRow(ag.data),
          range: { from, to },
        },
      });
    }

    const agreement: AgreementNormalized = agreementRes as AgreementNormalized;

    // Locations map (company_locations)
    const locRes = await admin.from("company_locations").select("id,name").eq("company_id", companyId);
    if (locRes.error) {
      return jsonErr(rid, "Kunne ikke hente lokasjoner.", 500, { code: "DB_ERROR", detail: asErrDetail(locRes.error) });
    }
    const locMap = new Map<string, string>();
    for (const l of locRes.data ?? []) locMap.set(String((l as any).id), safeStr((l as any).name));

    // Orders window (ACTIVE)
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
      } catch {
        // Ã¢Å“â€¦ Weekend/unsupported dates should not fail CSV export. We simply ignore them.
        continue;
      }

      const tier = asPlanTier(tierRaw);
      if (!tier) {
        // This is a true data/config error: keep as 500.
        return jsonErr(rid, "Kunne ikke lÃƒÂ¸se plan-tier for dato (forventer BASIS/LUXUS).", 500, {
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

    // Ã¢Å“â€¦ No invoice lines => return empty CSV (still 200)
    if (buckets.size === 0) {
      return emptyCsvResponse({
        rid,
        filename,
        reason: "NO_LINES",
        detail: {
          companyId,
          range: { from, to },
          ordersActiveCount: (oRes.data ?? []).length,
        },
      });
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

    const rows: string[] = [];
    rows.push(CSV_HEADER.join(","));
    for (const r of lines) {
      rows.push(
        csvLine([
          companyId,
          safeStr(company.name) || "Ã¢â‚¬â€",
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

    const headers = {
      ...noStoreHeaders(),
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-lp-rid": rid,
    } as Record<string, string>;

    return new Response(rows.join("\n") + "\n", { status: 200, headers });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(rid, "Uventet feil.", status, { code, detail: asErrDetail(e) });
  }
}
