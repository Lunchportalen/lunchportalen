// app/api/superadmin/companies/[companyId]/archive/orders/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function dateISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function errDetail(e: any) {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (e instanceof Error) return { name: e.name, message: e.message };
  try {
    return JSON.parse(JSON.stringify(e));
  } catch {
    return String(e);
  }
}

function isMissingColumn(err: any) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "").toLowerCase();
  return code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function csvEscape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.archive.orders.GET", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as any);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const url = new URL(req.url);
  const fromQ = safeStr(url.searchParams.get("from"));
  const toQ = safeStr(url.searchParams.get("to"));
  const statusQ = safeStr(url.searchParams.get("status")).toUpperCase();
  const format = safeStr(url.searchParams.get("format")).toLowerCase();

  const now = new Date();
  const defaultTo = dateISO(now);
  const defaultFrom = dateISO(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));

  const from = isISODate(fromQ) ? fromQ : defaultFrom;
  const to = isISODate(toQ) ? toQ : defaultTo;

  if (!isISODate(from) || !isISODate(to)) {
    return jsonErr(a.rid, "Ugyldig periode.", 400, "BAD_DATE");
  }
  if (from > to) {
    return jsonErr(a.rid, "Fra-dato kan ikke være etter til-dato.", 400, "BAD_DATE_RANGE");
  }

  const status = statusQ && statusQ !== "ALL" ? statusQ : "ALL";

  const admin = supabaseAdmin();

  let countQuery = admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", to);

  if (status !== "ALL") countQuery = countQuery.eq("status", status);

  const countRes = await countQuery;
  if (countRes.error) {
    return jsonErr(a.rid, "Kunne ikke telle ordre.", 500, { code: "ORDERS_COUNT_FAILED", detail: errDetail(countRes.error) });
  }

  const total = Number(countRes.count ?? 0);
  if (total > 5000) {
    return jsonErr(a.rid, "For mange ordrer i perioden. Snevr inn perioden.", 400, { code: "TOO_MANY_ROWS", detail: { total } });
  }

  let q = admin
    .from("orders")
    .select("id,date,status,slot,created_at,location_id,user_id,unit_price,tier,currency,line_total")
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (status !== "ALL") q = q.eq("status", status);

  const ordersRes = await q;
  if (ordersRes.error) {
    if (isMissingColumn(ordersRes.error)) {
      return jsonErr(a.rid, "Ordre-snapshot mangler felt (line_total/unit_price/tier/currency).", 500, { code: "ORDER_SNAPSHOT_MISSING", detail: errDetail(ordersRes.error) });
    }
    return jsonErr(a.rid, "Kunne ikke hente ordre.", 500, { code: "ORDERS_LOOKUP_FAILED", detail: errDetail(ordersRes.error) });
  }

  const rows = (ordersRes.data ?? []) as any[];
  const currencySet = new Set<string>();
  let totalRevenue = 0;

  for (const r of rows) {
    const v = toNum(r?.line_total);
    if (v === null) {
      return jsonErr(a.rid, "Ordre-snapshot mangler line_total.", 500, { code: "ORDER_SNAPSHOT_INVALID", detail: { line_total: r?.line_total } });
    }
    totalRevenue += v;

    const c = safeStr(r?.currency);
    if (!c) {
      return jsonErr(a.rid, "Ordre-snapshot mangler currency.", 500, { code: "ORDER_SNAPSHOT_INVALID", detail: { currency: r?.currency } });
    }
    currencySet.add(c);
  }

  if (currencySet.size > 1) {
    return jsonErr(a.rid, "Flere valutaer funnet i ordre-historikk.", 500, { code: "MULTI_CURRENCY", detail: { currencies: Array.from(currencySet) } });
  }

  const currency = currencySet.values().next().value ?? null;

  if (format === "csv") {
    const header = [
      "date",
      "status",
      "slot",
      "line_total",
      "currency",
      "tier",
      "unit_price",
      "order_id",
      "location_id",
      "user_id",
      "created_at",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const r of rows) {
      const line = [
        r?.date ?? "",
        r?.status ?? "",
        r?.slot ?? "",
        r?.line_total ?? "",
        r?.currency ?? "",
        r?.tier ?? "",
        r?.unit_price ?? "",
        r?.id ?? "",
        r?.location_id ?? "",
        r?.user_id ?? "",
        r?.created_at ?? "",
      ].map(csvEscape);

      lines.push(line.join(","));
    }

    const csv = lines.join("\n");
    const filename = `archive_orders_${companyId}_${from}_to_${to}_${status}.csv`;

    return jsonOk(a.rid, { csv, filename, contentType: "text/csv; charset=utf-8" }, 200);
  }

  return jsonOk(a.rid, {
    rows,
    totalOrders: total,
    totalRevenue,
    currency,
    range: { from, to },
    status,
  }, 200);
}
