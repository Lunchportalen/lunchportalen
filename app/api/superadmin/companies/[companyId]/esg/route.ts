// app/api/superadmin/companies/[companyId]/esg/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, isISODate as isISODateSimple } from "@/lib/http/routeGuard";
import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
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
  if (c.dateISO !== deliveryDateISO) return false;
  return c.hh < 8;
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const s: any = await scopeOr401(req);
  if (!s?.ok) return s.res ?? s.response;

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.esg.GET", ["superadmin"]);
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

  const res = await admin
    .from("orders")
    .select("date,status,cancelled_at,updated_at")
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", to);

  if (res.error) {
    return jsonErr(a.rid, "Kunne ikke hente ESG-data.", 500, { code: "DB_ERROR", detail: res.error });
  }

  const rows = (res.data ?? []) as any[];

  let deliveredCount = 0;
  let cancelledInTimeCount = 0;

  for (const r of rows) {
    const status = safeStr((r as any)?.status).toUpperCase();
    const date = safeStr((r as any)?.date);
    if (!date) continue;

    if (status === "DELIVERED") deliveredCount += 1;

    if (status === "CANCELLED" || status === "CANCELED") {
      const ts = (r as any)?.cancelled_at ?? (r as any)?.updated_at ?? null;
      if (cancelledBefore0800Oslo(date, ts ? String(ts) : null)) cancelledInTimeCount += 1;
    }
  }

  const savedPortionsEstimate = cancelledInTimeCount;

  await auditWriteMust({
    rid: a.rid,
    action: "ESG_EXPORT",
    entity_type: "company",
    entity_id: companyId,
    company_id: companyId,
    actor_user_id: a.scope?.userId ?? null,
    actor_email: a.scope?.email ?? null,
    actor_role: "superadmin",
    summary: "Eksporterte ESG-sammendrag",
    detail: { companyId, from, to, delivered_count: deliveredCount, cancelled_in_time_count: cancelledInTimeCount },
  });

  await logIncident({
    scope: "esg",
    severity: "info",
    rid: a.rid,
    message: "ESG summary exported",
    meta: { companyId, from, to, delivered_count: deliveredCount, cancelled_in_time_count: cancelledInTimeCount },
  });

  console.info("[api/superadmin/companies/esg] summary", { rid: a.rid, companyId, from, to });

  return jsonOk(
    a.rid,
    {
      companyId,
      from,
      to,
      delivered_count: deliveredCount,
      cancelled_in_time_count: cancelledInTimeCount,
      saved_portions_estimate: savedPortionsEstimate,
      comment: "Basert på faktisk ordredata",
    },
    200
  );
}
