// app/api/superadmin/cfo/summary/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, isISODate as isISODateSimple } from "@/lib/http/routeGuard";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { logIncident } from "@/lib/observability/incident";

const MAX_DAYS = 366;
const MAX_ROWS = 20000;
const PAGE_SIZE = 1000;

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function toInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function diffDaysInclusive(from: string, to: string) {
  const a = new Date(from + "T00:00:00.000Z");
  const b = new Date(to + "T00:00:00.000Z");
  const diff = Math.floor((b.getTime() - a.getTime()) / 86400000);
  return diff + 1;
}

function errMessage(err: any) {
  return safeStr(err?.message || err?.details || err?.hint || err?.code || "");
}

function isMissingColumn(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function normStatus(v: any) {
  return safeStr(v).toUpperCase();
}

function getOsloParts(dt: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(dt);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");

  return { dateISO: `${y}-${m}-${d}`, hh };
}

function cancelledBefore0800Oslo(deliveryDateISO: string, cancelledAtISO: string | null) {
  if (!cancelledAtISO) return false;
  const c = getOsloParts(new Date(cancelledAtISO));
  if (c.dateISO != deliveryDateISO) return false;
  return c.hh < 8;
}

function normalizeCancelled(status: string) {
  const s = status.toUpperCase();
  return s === "CANCELLED" || s === "CANCELED" || s === "CANCELLED_BY_USER";
}

export async function GET(req: NextRequest): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return s.res ?? s.response;

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.cfo.summary.GET", ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const fromQ = safeStr(url.searchParams.get("from"));
  const toQ = safeStr(url.searchParams.get("to"));

  const today = osloTodayISODate();
  const defaultFrom = addDaysISO(today, -30);

  const from = isISODateSimple(fromQ) ? fromQ : defaultFrom;
  const to = isISODateSimple(toQ) ? toQ : today;

  if (!isISODateSimple(from) || !isISODateSimple(to)) {
    return jsonErr(a.rid, "Ugyldig periode.", 400, "BAD_REQUEST");
  }
  if (from > to) {
    return jsonErr(a.rid, "Fra-dato kan ikke være etter til-dato.", 400, "BAD_REQUEST");
  }

  const days = diffDaysInclusive(from, to);
  if (days > MAX_DAYS) {
    return jsonErr(a.rid, `For lang periode. Maks ${MAX_DAYS} dager.`, 400, "RANGE_TOO_LARGE");
  }

  const admin = supabaseAdmin();

  const countRes = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("date", from)
    .lte("date", to);

  if (countRes.error) {
    return jsonErr(a.rid, "Kunne ikke telle ordre.", 500, { code: "DB_ERROR", detail: countRes.error });
  }

  const totalRows = Number(countRes.count ?? 0);
  if (totalRows > MAX_ROWS) {
    return jsonErr(a.rid, "For mange ordre i perioden. Snevr inn datoene.", 400, {
      code: "TOO_MANY_ROWS",
      detail: { total: totalRows, max: MAX_ROWS },
    });
  }

  let cancelledAtAvailable = true;
  let missingCancelledAtColumn = false;

  let totalOrders = 0;
  let deliveredCount = 0;
  let cancelledTotal = 0;
  let cancelledInTime = 0;
  let cancelledLate = 0;
  let cancelledMissingTs = 0;

  let revenueSum = 0;
  let priceMissing = 0;
  let priceRows = 0;

  const byCompany = new Map<string, { company_id: string; orders: number; cancelled: number; revenue_sum: number; price_missing: number }>();
  const byDay = new Map<string, { date: string; orders: number; cancelled: number }>();
  const byWeek = new Map<string, { week_start: string; from: string; to: string; orders: number; cancelled: number }>();

  async function fetchPage(offset: number, selectCols: string) {
    return admin
      .from("orders")
      .select(selectCols)
      .gte("date", from)
      .lte("date", to)
      .range(offset, Math.min(offset + PAGE_SIZE - 1, totalRows - 1));
  }

  let selectCols = "company_id,date,status,unit_price,updated_at,cancelled_at";

  if (totalRows > 0) {
    let offset = 0;

    let first = await fetchPage(0, selectCols);
    if (first.error && isMissingColumn(first.error)) {
      cancelledAtAvailable = false;
      missingCancelledAtColumn = true;
      selectCols = "company_id,date,status,unit_price,updated_at";
      first = await fetchPage(0, selectCols);
    }
    if (first.error) {
      return jsonErr(a.rid, "Kunne ikke hente ordre.", 500, { code: "DB_ERROR", detail: first.error });
    }

    const processRows = (rows: any[]) => {
      for (const r of rows ?? []) {
        totalOrders += 1;
        const companyId = safeStr((r as any)?.company_id) || "unknown";
        const date = safeStr((r as any)?.date);
        const status = normStatus((r as any)?.status);
        const isCancelled = normalizeCancelled(status);

        const companyAgg = byCompany.get(companyId) ?? {
          company_id: companyId,
          orders: 0,
          cancelled: 0,
          revenue_sum: 0,
          price_missing: 0,
        };

        companyAgg.orders += 1;
        if (isCancelled) companyAgg.cancelled += 1;

        const unitPriceRaw = (r as any)?.unit_price;
        const unitPrice = Number(unitPriceRaw);
        priceRows += 1;
        if (Number.isFinite(unitPrice) && unitPriceRaw !== null && unitPriceRaw !== undefined) {
          revenueSum += unitPrice;
          companyAgg.revenue_sum += unitPrice;
        } else {
          priceMissing += 1;
          companyAgg.price_missing += 1;
        }

        byCompany.set(companyId, companyAgg);

        if (status === "DELIVERED") deliveredCount += 1;
        if (isCancelled) cancelledTotal += 1;

        if (date) {
          const day = byDay.get(date) ?? { date, orders: 0, cancelled: 0 };
          day.orders += 1;
          if (isCancelled) day.cancelled += 1;
          byDay.set(date, day);

          const ws = startOfWeekISO(date);
          const week = byWeek.get(ws) ?? { week_start: ws, from: ws, to: addDaysISO(ws, 7), orders: 0, cancelled: 0 };
          week.orders += 1;
          if (isCancelled) week.cancelled += 1;
          byWeek.set(ws, week);
        }

        if (isCancelled) {
          const ts = cancelledAtAvailable
            ? (r as any)?.cancelled_at ?? (r as any)?.updated_at ?? null
            : (r as any)?.updated_at ?? null;
          const tsISO = ts ? String(ts) : null;
          if (!tsISO) {
            cancelledMissingTs += 1;
          } else if (date && cancelledBefore0800Oslo(date, tsISO)) {
            cancelledInTime += 1;
          } else {
            cancelledLate += 1;
          }
        }
      }
    };

    processRows(first.data ?? []);
    offset += PAGE_SIZE;

    while (offset < totalRows) {
      const res = await fetchPage(offset, selectCols);
      if (res.error) {
        return jsonErr(a.rid, "Kunne ikke hente ordre (paginering).", 500, { code: "DB_ERROR", detail: res.error });
      }
      processRows(res.data ?? []);
      offset += PAGE_SIZE;
    }
  }

  const missingRatio = priceRows > 0 ? priceMissing / priceRows : 0;
  const revenue = missingRatio > 0.2 ? null : Number(revenueSum.toFixed(2));

  const warnings: string[] = [];
  if (priceMissing > 0) {
    warnings.push(`Mangler unit_price på ${priceMissing} av ${priceRows} ordre (${Math.round(missingRatio * 100)}%).`);
  }
  if (missingCancelledAtColumn) {
    warnings.push("Mangler cancelled_at-kolonne; bruker updated_at som fallback.");
  }
  if (cancelledMissingTs > 0) {
    warnings.push(`Mangler kanselleringstid for ${cancelledMissingTs} ordre.`);
  }

  const stabilityRate = totalOrders > 0 ? Number(((totalOrders - cancelledTotal) / totalOrders).toFixed(4)) : null;

  const top = Array.from(byCompany.values())
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  const topIds = top.map((t) => t.company_id).filter((id) => id && id !== "unknown");
  const companyMap = new Map<string, { name: string | null; orgnr: string | null; status: string | null; archived: boolean }>();

  if (topIds.length) {
    const compRes = await admin
      .from("companies")
      .select("id,name,orgnr,status,deleted_at")
      .in("id", topIds);

    if (!compRes.error) {
      for (const c of compRes.data ?? []) {
        const id = safeStr((c as any)?.id);
        if (!id) continue;
        const status = safeStr((c as any)?.status) || null;
        const archived = Boolean((c as any)?.deleted_at) || status?.toLowerCase() === "closed";
        companyMap.set(id, {
          name: safeStr((c as any)?.name) || null,
          orgnr: safeStr((c as any)?.orgnr) || null,
          status,
          archived,
        });
      }
    }
  }

  const topCompanies = top.map((t) => {
    const meta = companyMap.get(t.company_id) ?? { name: null, orgnr: null, status: null, archived: false };
    return {
      company_id: t.company_id,
      company_name: meta.name,
      orgnr: meta.orgnr,
      status: meta.status,
      archived: meta.archived,
      orders: t.orders,
      cancelled: t.cancelled,
      revenue_sum: t.revenue_sum,
      price_missing: t.price_missing,
    };
  });

  const volumeByDay = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  const volumeByWeek = Array.from(byWeek.values()).sort((a, b) => a.week_start.localeCompare(b.week_start));

  const [activeCompanies, archivedCompanies] = await Promise.all([
    admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .or("status.eq.closed,deleted_at.not.is.null"),
  ]);

  const activeCount = Number(activeCompanies.count ?? 0);
  const archivedCount = Number(archivedCompanies.count ?? 0);

  const riskIndicators: { level: "LOW" | "MEDIUM" | "HIGH"; reasons: string[] } = {
    level: "LOW",
    reasons: [],
  };

  if (stabilityRate !== null && stabilityRate < 0.8) {
    riskIndicators.level = "HIGH";
    riskIndicators.reasons.push("Høy avbestillingsrate");
  } else if (stabilityRate !== null && stabilityRate < 0.9) {
    riskIndicators.level = "MEDIUM";
    riskIndicators.reasons.push("Moderat avbestillingsrate");
  }

  if (missingRatio > 0.2) {
    riskIndicators.level = riskIndicators.level === "HIGH" ? "HIGH" : "MEDIUM";
    riskIndicators.reasons.push("Manglende pris-snapshot for mange ordre");
  }

  if (cancelledTotal > 0 && cancelledLate / Math.max(cancelledTotal, 1) > 0.5) {
    riskIndicators.level = riskIndicators.level === "LOW" ? "MEDIUM" : riskIndicators.level;
    riskIndicators.reasons.push("Stor andel sene avbestillinger");
  }

  await logIncident({
    scope: "cfo",
    severity: "info",
    rid: a.rid,
    message: "CFO summary generated",
    meta: { from, to, totalOrders },
  });

  return jsonOk(
    a.rid,
    {
      from,
      to,
      totals: {
        orders: totalOrders,
        revenue_nok: revenue,
        revenue_missing: { missing: priceMissing, total: priceRows, ratio: Number(missingRatio.toFixed(4)) },
      },
      stability: {
        delivered: deliveredCount,
        cancelled: cancelledTotal,
        stability_rate: stabilityRate,
      },
      cancellations: {
        before_0800: cancelledInTime,
        after_0800: cancelledLate,
        missing_timestamp: cancelledMissingTs,
        source: cancelledAtAvailable ? "cancelled_at (fallback updated_at)" : "updated_at",
      },
      companies: {
        active: activeCount,
        archived: archivedCount,
      },
      top_companies: topCompanies,
      volume_by_day: volumeByDay,
      volume_by_week: volumeByWeek,
      warnings,
      risk_indicators: riskIndicators,
      meta: {
        max_rows: MAX_ROWS,
        page_size: PAGE_SIZE,
      },
    },
    200
  );
}
