// app/api/admin/orders/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { osloTodayISODate } from "@/lib/date/oslo";
import { getScope, allowSuperadminOrCompanyAdmin, mustCompanyId } from "@/lib/auth/scope";

/* =========================================================
   Helpers
========================================================= */
function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isoToNO(d: string) {
  // YYYY-MM-DD -> DD-MM-YYYY
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

// Join kan komme som object eller array (Supabase/PostgREST)
function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function jsonErr(status: number, rid: string, error: string, detail?: string) {
  return NextResponse.json({ ok: false, rid, error, detail }, { status });
}

/**
 * ADMIN / ORDERS
 * - company_admin: only orders for own company
 * - superadmin: can view all, or filter by ?company_id=
 * - date defaults to Oslo "today" if missing/invalid
 * - status defaults to ACTIVE
 * - returns both ISO date + dateNO (DD-MM-YYYY)
 */
export async function GET(req: NextRequest) {
  const rid = `admin_orders_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const url = new URL(req.url);

    /* =========================
       Params
    ========================= */
    const dateQ = url.searchParams.get("date");
    const dateISO = dateQ && isISODate(dateQ) ? dateQ : osloTodayISODate();
    const dateNO = isoToNO(dateISO);

    const requestedCompanyId = url.searchParams.get("company_id");
    const statusQ = url.searchParams.get("status");
    const status = statusQ ? String(statusQ).toUpperCase() : "ACTIVE";

    /* =========================
       Scope & access
    ========================= */
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    const companyId =
      scope.role === "superadmin"
        ? requestedCompanyId
          ? String(requestedCompanyId)
          : null
        : mustCompanyId(scope);

    /* =========================
       Read orders
    ========================= */
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

    if (error) {
      return jsonErr(500, rid, "ORDERS_READ_FAILED", error.message);
    }

    /* =========================
       Normalize joins + date
    ========================= */
    const orders = (rows ?? []).map((r: any) => ({
      ...r,
      dateISO: r.date,
      dateNO,
      companies: first(r.companies),
      company_locations: first(r.company_locations),
    }));

    return NextResponse.json(
      {
        ok: true,
        rid,
        dateISO,
        dateNO,
        company_id: companyId,
        status,
        count: orders.length,
        orders,
      },
      { status: 200 }
    );
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(status, rid, code, String(e?.message ?? e));
  }
}
