// app/api/admin/orders/export/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { osloTodayISODate } from "@/lib/date/oslo";
import { getScope, allowSuperadminOrCompanyAdmin, mustCompanyId } from "@/lib/auth/scope";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isoToNO(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

function csvEscape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // CSV standard: wrap in quotes if it contains comma, quote, newline
  if (/[,"\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function jsonErr(status: number, rid: string, error: string, detail?: string) {
  return NextResponse.json({ ok: false, rid, error, detail }, { status });
}

export async function GET(req: NextRequest) {
  const rid = `admin_orders_csv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const url = new URL(req.url);

    const dateQ = url.searchParams.get("date");
    const dateISO = dateQ && isISODate(dateQ) ? dateQ : osloTodayISODate();
    const dateNO = isoToNO(dateISO);

    const statusQ = url.searchParams.get("status");
    const status = statusQ ? String(statusQ).toUpperCase() : "ACTIVE";

    const requestedCompanyId = url.searchParams.get("company_id");

    // 1) scope lock
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    // 2) company filter
    const companyId =
      scope.role === "superadmin"
        ? requestedCompanyId
          ? String(requestedCompanyId)
          : null
        : mustCompanyId(scope);

    // 3) read orders (service role for stable reads, but we apply scope filter in code)
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
    if (error) return jsonErr(500, rid, "ORDERS_READ_FAILED", error.message);

    // normalize join (object vs array)
    const norm = (v: any) => (Array.isArray(v) ? v[0] ?? null : v ?? null);

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

    for (const r of rows ?? []) {
      const comp = norm((r as any).companies);
      const loc = norm((r as any).company_locations);

      const line = [
        dateISO,
        dateNO,
        status,
        (r as any).created_at ?? "",
        (r as any).id ?? "",
        (r as any).user_id ?? "",
        (r as any).company_id ?? "",
        comp?.name ?? "",
        (r as any).location_id ?? "",
        loc?.label ?? "",
        loc?.name ?? "",
        loc?.postal_code ?? "",
        loc?.city ?? "",
        loc?.address ?? loc?.address_line1 ?? "",
        (r as any).slot ?? "",
        (r as any).note ?? "",
      ].map(csvEscape);

      lines.push(line.join(","));
    }

    const csv = lines.join("\n");
    const filename = `orders_${dateNO}_${status}${companyId ? `_company_${companyId}` : ""}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "x-lp-rid": rid,
      },
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(status, rid, code, String(e?.message ?? e));
  }
}
