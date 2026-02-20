// app/api/superadmin/companies/[companyId]/invoice-basis/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, isISODate as isISODateSimple } from "@/lib/http/routeGuard";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { auditWriteMust } from "@/lib/audit/auditWrite";
import { logIncident } from "@/lib/observability/incident";

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

function errMessage(err: any) {
  return safeStr(err?.message || err?.details || err?.hint || err?.code || "");
}

function isMissingColumn(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return s.res ?? s.response;

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.invoice-basis.GET", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as any);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const url = new URL(req.url);
  const fromQ = safeStr(url.searchParams.get("from"));
  const toQ = safeStr(url.searchParams.get("to"));

  const today = osloTodayISODate();
  const defaultFrom = addDaysISO(today, -90);

  const from = isISODateSimple(fromQ) ? fromQ : defaultFrom;
  const to = isISODateSimple(toQ) ? toQ : today;

  if (!isISODateSimple(from) || !isISODateSimple(to)) {
    return jsonErr(a.rid, "Ugyldig periode.", 400, "BAD_REQUEST");
  }
  if (from > to) {
    return jsonErr(a.rid, "Fra-dato kan ikke være etter til-dato.", 400, "BAD_REQUEST");
  }

  const admin = supabaseAdmin();

  const selectCols = "date,status,unit_price,currency";
  const selectFallback = "date,status";

  let warning: string | null = null;

  let data: any[] | null | undefined;
  let error: any;

  ({ data, error } = await admin
    .from("orders")
    .select(selectCols)
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", to)
    .in("status", ["DELIVERED", "delivered"]));

  if (error && isMissingColumn(error)) {
    warning = "Manglende pris-snapshot";
    ({ data, error } = await admin
      .from("orders")
      .select(selectFallback)
      .eq("company_id", companyId)
      .gte("date", from)
      .lte("date", to)
      .in("status", ["DELIVERED", "delivered"]));
  }

  if (error) {
    return jsonErr(a.rid, error.message, 500, { code: "DB_ERROR", detail: error });
  }

  const rows = (data ?? []) as any[];

  let sum: number | null = null;
  let currency: string | null = null;

  const byDay = new Map<string, { date: string; delivered_count: number; sum: number | null }>();
  const byWeek = new Map<string, { week_start: string; from: string; to: string; delivered_count: number; sum: number | null }>();

  for (const r of rows) {
    const date = safeStr((r as any)?.date);
    if (!date) continue;

    const unitPriceRaw = (r as any)?.unit_price;
    const unitPrice = Number(unitPriceRaw ?? 0);
    if (warning || unitPriceRaw === null || typeof unitPriceRaw === "undefined") {
      warning = "Manglende pris-snapshot";
    }

    if (!currency) {
      const cur = safeStr((r as any)?.currency);
      if (cur) currency = cur;
    }

    const day = byDay.get(date) ?? { date, delivered_count: 0, sum: warning ? null : 0 };
    day.delivered_count += 1;
    if (!warning && day.sum !== null) day.sum += unitPrice;
    byDay.set(date, day);

    const ws = startOfWeekISO(date);
    const week = byWeek.get(ws) ?? {
      week_start: ws,
      from: ws,
      to: addDaysISO(ws, 7),
      delivered_count: 0,
      sum: warning ? null : 0,
    };
    week.delivered_count += 1;
    if (!warning && week.sum !== null) week.sum += unitPrice;
    byWeek.set(ws, week);

  }

  if (!warning) {
    sum = (rows ?? []).reduce((acc, r) => acc + Number((r as any)?.unit_price ?? 0), 0);
  }

  if (warning) {
    sum = null;
    for (const v of byDay.values()) v.sum = null;
    for (const v of byWeek.values()) v.sum = null;
  }

  const by_day = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  const by_week = Array.from(byWeek.values()).sort((a, b) => a.week_start.localeCompare(b.week_start));

  await auditWriteMust({
    rid: a.rid,
    action: "INVOICE_EXPORT",
    entity_type: "company",
    entity_id: companyId,
    company_id: companyId,
    actor_user_id: a.scope?.userId ?? null,
    actor_email: a.scope?.email ?? null,
    actor_role: "superadmin",
    summary: "Genererte fakturagrunnlag",
    detail: { companyId, from, to, delivered_count: rows.length, warning },
  });

  await logIncident({
    scope: "billing",
    severity: "info",
    rid: a.rid,
    message: "Invoice basis generated",
    meta: { companyId, from, to, delivered_count: rows.length, warning },
  });

  console.info("[api/superadmin/companies/invoice-basis] generated", { rid: a.rid, companyId, from, to });

  return jsonOk(
    a.rid,
    {
      companyId,
      from,
      to,
      delivered_count: rows.length,
      sum,
      currency,
      warning,
      by_day,
      by_week,
    },
    200
  );
}
