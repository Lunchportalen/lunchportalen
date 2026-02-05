// app/api/admin/orders/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { osloTodayISODate } from "@/lib/date/oslo";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

/* =========================================================
   Helpers
========================================================= */

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}
function isoToNO(d: string) {
  const [y, m, day] = String(d).split("-");
  return `${day}-${m}-${y}`;
}
// Join kan komme som object eller array (Supabase/PostgREST)
function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}
function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normStatus(v: any) {
  const s = safeStr(v).toUpperCase();
  if (!s) return "ACTIVE";
  // tillat common variants
  if (s === "CANCELED") return "CANCELLED";
  if (s === "CANCEL") return "CANCELLED";
  if (s === "PLACED") return "ACTIVE";
  return s;
}

/* =========================================================
   GET /api/admin/orders
   - superadmin kan hente alle firma (eller filtere på company_id)
   - company_admin er låst til scope.companyId
========================================================= */
export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.orders.read", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  try {
    const url = new URL(req.url);

    const dateQ = safeStr(url.searchParams.get("date"));
    const dateISO = dateQ && isISODate(dateQ) ? dateQ : osloTodayISODate();
    const dateNO = isoToNO(dateISO);

    const statusQ = safeStr(url.searchParams.get("status"));
    const status = normStatus(statusQ || "ACTIVE");

    // superadmin: optional ?company_id= (tom => alle firma)
    // company_admin: låst til egen companyId via scope
    const isSuperadmin = String(scope.role ?? "").trim().toLowerCase() === "superadmin";
    const denyScope = isSuperadmin
      ? requireCompanyScopeOr403(a.ctx, { allowSuperadminGlobal: true })
      : requireCompanyScopeOr403(a.ctx);
    if (denyScope) return denyScope;

    const companyIdQuery = safeStr(url.searchParams.get("company_id")) || null;
    const companyId = isSuperadmin ? companyIdQuery : safeStr(scope.companyId) || null;
    if (!companyId && !isSuperadmin) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

    const admin = supabaseAdmin();

    // NB: Supabase/PostgREST kan returnere join som object/array avhengig av relasjon.
    let q = admin
      .from("orders")
      .select(
        `
        id,
        user_id,
        note,
        created_at,
        updated_at,
        company_id,
        location_id,
        slot,
        date,
        status,
        companies (
          id,
          name
        ),
        company_locations (
          id,
          name,
          label,
          address,
          address_line1,
          postal_code,
          city,
          delivery_json
        )
      `
      )
      .eq("date", dateISO)
      .eq("status", status)
      .order("created_at", { ascending: true });

    if (companyId) q = q.eq("company_id", companyId);

    const { data: rows, error } = await q;

    if (error) {
      return jsonErr(rid, "Kunne ikke hente ordre.", 500, { code: "ORDERS_READ_FAILED", detail: {
        message: error.message,
        code: (error as any).code ?? null,
        date: dateISO,
        status,
        company_id: companyId,
      } });
    }

    const orders = (rows ?? []).map((row: any) => {
      const c = first(row.companies);
      const l = first(row.company_locations);

      return {
        id: row.id,
        user_id: row.user_id,
        note: row.note ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        company_id: row.company_id,
        location_id: row.location_id,
        slot: row.slot ?? null,
        date: row.date,
        status: normStatus(row.status),
        dateISO: row.date,
        dateNO,
        companies: c,
        company_locations: l,
      };
    });

    return jsonOk(rid, {
      dateISO,
      dateNO,
      company_id: companyId ?? null,
      status,
      count: orders.length,
      orders,
    });
  } catch (e: any) {
    return jsonErr(rid, String(e?.message ?? "Unknown error"), 500, { code: "UNHANDLED", detail: { at: "admin/orders" } });
  }
}
