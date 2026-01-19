// app/api/admin/orders/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { osloTodayISODate } from "@/lib/date/oslo";
import { getScope, allowSuperadminOrCompanyAdmin, mustCompanyId } from "@/lib/auth/scope";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

// Join kan komme som object eller array (Supabase/PostgREST)
function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function jsonErr(status: number, rid: string, error: string, detail?: string) {
  return NextResponse.json({ ok: false, rid, error, detail }, { status });
}

/**
 * ADMIN / ORDERS
 * - company_admin: only orders for own company
 * - superadmin: can view all, or filter by ?company_id=
 * - date defaults to Oslo "today" if missing/invalid
 * - returns ACTIVE orders by default (matches your original behavior)
 */
export async function GET(req: NextRequest) {
  const rid = `admin_orders_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const url = new URL(req.url);

    // date
    const dateQ = url.searchParams.get("date");
    const date = dateQ && isISODate(dateQ) ? dateQ : osloTodayISODate();

    // optional filters (superadmin only for company_id)
    const requestedCompanyId = url.searchParams.get("company_id");
    const statusQ = url.searchParams.get("status"); // optional override
    const status = statusQ ? String(statusQ).toUpperCase() : "ACTIVE";

    // 1) scope lock (tenant security)
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    // 2) Determine effective company filter
    const companyId =
      scope.role === "superadmin"
        ? (requestedCompanyId ? String(requestedCompanyId) : null) // null => all companies
        : mustCompanyId(scope);

    // 3) Read orders
    // We use admin client because we join + need stable reads even if RLS changes,
    // but we still apply strict scope filtering in code (enterprise rule).
    const admin = supabaseAdmin();

    let q = (admin as any)
      .from("orders")
      .select(
        `
        id,
        user_id,
        note,
        created_at,
        company_id,
        location_id,
        date,
        status,
        companies ( id, name ),
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
      .eq("date", date)
      .eq("status", status)
      .order("created_at", { ascending: true });

    if (companyId) q = q.eq("company_id", companyId);

    const { data: rows, error } = await q;

    if (error) {
      return jsonErr(500, rid, "ORDERS_READ_FAILED", error.message);
    }

    // 4) Normalize join fields to objects (not arrays) for stable frontend
    const normalized = (rows ?? []).map((r: any) => ({
      ...r,
      companies: first(r.companies),
      company_locations: first(r.company_locations),
    }));

    return NextResponse.json(
      { ok: true, rid, date, company_id: companyId, status, count: normalized.length, orders: normalized },
      { status: 200 }
    );
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(status, rid, code, String(e?.message ?? e));
  }
}
