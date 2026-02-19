// app/api/admin/orders/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";
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

function isAllowedStatus(v: string) {
  const s = normStatus(v);
  return s === "ACTIVE" || s === "CANCELLED";
}

/* =========================================================
   GET /api/admin/orders
   - superadmin kan hente alle firma (eller filtere på company_id)
   - company_admin er låst til scope.companyId
   - IMPORTANT: payload har alltid orders: [] (aldri non-array)
========================================================= */
export async function GET(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.orders.read", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  const url = new URL(req.url);

  // date
  const dateQ = safeStr(url.searchParams.get("date"));
  const dateISO = dateQ && isISODate(dateQ) ? dateQ : osloTodayISODate();
  const dateNO = isoToNO(dateISO);

  // status
  const statusQ = safeStr(url.searchParams.get("status")) || "ACTIVE";
  const statusNorm = normStatus(statusQ);
  const status: "ACTIVE" | "CANCELLED" = isAllowedStatus(statusNorm) ? (statusNorm as any) : "ACTIVE";

  // scope rules
  const role = safeStr((scope as any).role).toLowerCase();
  const isSuperadmin = role === "superadmin";

  // superadmin: kan være global uten company scope
  const denyScope = isSuperadmin
    ? requireCompanyScopeOr403(a.ctx, { allowSuperadminGlobal: true })
    : requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  // company
  const companyIdQuery = safeStr(url.searchParams.get("company_id")) || null;
  const companyId = isSuperadmin ? companyIdQuery : safeStr(scope.companyId) || null;

  if (!companyId && !isSuperadmin) {
    return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
  }

  try {
    const admin = supabaseAdmin();

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

    // ✅ Enterprise-hardening: aldri knekk klient med error-shape på dette endepunktet.
    // Returner ok + tomt datasett med warning.
    if (error) {
      return jsonOk(
        rid,
        {
          ok: true,
          dateISO,
          dateNO,
          company_id: companyId ?? null,
          status,
          count: 0,
          orders: [],
          meta: {
            role,
            superadmin_global: isSuperadmin && !companyId,
            received: { date: dateQ || null, status: statusQ || null, company_id: companyIdQuery },
            warning: {
              code: "ORDERS_READ_FAILED",
              message: error.message,
              pgCode: (error as any).code ?? null,
            },
          },
        },
        200
      );
    }

    const orders = (Array.isArray(rows) ? rows : []).map((row: any) => {
      const c = first<any>(row.companies);
      const l = first<any>(row.company_locations);

      const st = normStatus(row.status) === "CANCELLED" ? "CANCELLED" : "ACTIVE";

      return {
        id: String(row.id),
        user_id: String(row.user_id),
        note: row.note ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        company_id: String(row.company_id),
        location_id: row.location_id ? String(row.location_id) : null,
        slot: row.slot ?? null,
        date: String(row.date),
        status: st as "ACTIVE" | "CANCELLED",
        dateISO: String(row.date),
        dateNO,
        companies: c ? { id: String(c.id), name: c.name ?? null } : null,
        company_locations: l
          ? {
              id: String(l.id),
              name: l.name ?? null,
              label: l.label ?? null,
              address: l.address ?? null,
              address_line1: l.address_line1 ?? null,
              postal_code: l.postal_code ?? null,
              city: l.city ?? null,
              delivery_json: l.delivery_json ?? null,
            }
          : null,
      };
    });

    return jsonOk(
      rid,
      {
        ok: true,
        dateISO,
        dateNO,
        company_id: companyId ?? null,
        status,
        count: orders.length,
        orders,
        meta: {
          role,
          superadmin_global: isSuperadmin && !companyId,
          received: { date: dateQ || null, status: statusQ || null, company_id: companyIdQuery },
        },
      },
      200
    );
  } catch (e: any) {
    // ✅ Enterprise-hardening: også her – aldri returner en shape som kan knekke UI
    return jsonOk(
      rid,
      {
        ok: true,
        dateISO,
        dateNO,
        company_id: companyId ?? null,
        status,
        count: 0,
        orders: [],
        meta: {
          role,
          superadmin_global: isSuperadmin && !companyId,
          received: { date: dateQ || null, status: statusQ || null, company_id: companyIdQuery },
          warning: { code: "UNHANDLED", message: String(e?.message ?? e) },
        },
      },
      200
    );
  }
}
