// app/api/admin/orders/export/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { osloTodayISODate } from "@/lib/date/oslo";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonErr } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

/* =========================================================
   Utils
========================================================= */

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}
function isoToNO(d: string) {
  const [y, m, day] = String(d).split("-");
  return `${day}-${m}-${y}`;
}
function csvEscape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
// Join kan komme som object eller array (Supabase/PostgREST)
function normJoin(v: any) {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
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

/* =========================================================
   GET /api/admin/orders/export (CSV)
========================================================= */
export async function GET(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.orders.export", ["company_admin", "superadmin"]);
  if (denyRole) return denyRole;

  // company_admin må ha company scope; superadmin kan være uten scope
  if (scope.role === "company_admin") {
    const denyScope = requireCompanyScopeOr403(a.ctx);
    if (denyScope) return denyScope;
  }

  try {
    const url = new URL(req.url);

    const dateQ = url.searchParams.get("date");
    const dateISO = dateQ && isISODate(dateQ) ? dateQ : osloTodayISODate();
    const dateNO = isoToNO(dateISO);

    const statusQ = url.searchParams.get("status");
    const status = statusQ ? String(statusQ).toUpperCase().trim() : "ACTIVE";

    const requestedCompanyIdRaw = url.searchParams.get("company_id");
    const requestedCompanyId = requestedCompanyIdRaw ? String(requestedCompanyIdRaw).trim() : null;

    // Tenant filter:
    // - superadmin: kan sette company_id, null = alle
    // - company_admin: låst til scope.companyId
    const scopedCompanyId = String(scope.companyId ?? "").trim();
    const companyId = scope.role === "superadmin" ? requestedCompanyId : scopedCompanyId;

    const admin = supabaseAdmin();

    let q = admin
      .from("orders")
      .select(
        `
        id,
        user_id,
        date,
        status,
        slot,
        note,
        created_at,
        company_id,
        location_id,
        companies ( id, name ),
        company_locations ( id, name, label, postal_code, city, address, address_line1 )
      `
      )
      .eq("date", dateISO)
      .eq("status", status)
      .order("created_at", { ascending: true });

    if (companyId) q = q.eq("company_id", companyId);

    const { data: rows, error } = await q;
    if (error) return jsonErr(500, rid, "ORDERS_READ_FAILED", "Kunne ikke hente ordre.", errDetail(error));

    const header = [
      "dateISO",
      "dateNO",
      "status",
      "created_at",
      "order_id",
      "user_id",
      "company_id",
      "company_name",
      "location_id",
      "location_label",
      "location_name",
      "postal_code",
      "city",
      "address",
      "slot",
      "note",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const row of rows ?? []) {
      const comp = normJoin((row as any).companies);
      const loc = normJoin((row as any).company_locations);

      const line = [
        dateISO,
        dateNO,
        status,
        (row as any).created_at ?? "",
        (row as any).id ?? "",
        (row as any).user_id ?? "",
        (row as any).company_id ?? "",
        comp?.name ?? "",
        (row as any).location_id ?? "",
        loc?.label ?? "",
        loc?.name ?? "",
        loc?.postal_code ?? "",
        loc?.city ?? "",
        loc?.address ?? loc?.address_line1 ?? "",
        (row as any).slot ?? "",
        (row as any).note ?? "",
      ].map(csvEscape);

      lines.push(line.join(","));
    }

    const csv = lines.join("\n");
    const filename = `orders_${dateNO}_${status}${companyId ? `_company_${companyId}` : ""}.csv`;

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
    return jsonErr(status, rid, code, String(e?.message ?? e), errDetail(e));
  }
}
