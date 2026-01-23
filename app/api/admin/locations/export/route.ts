// app/api/admin/locations/export/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getScope, allowSuperadminOrCompanyAdmin, mustCompanyId } from "@/lib/auth/scope";

function jsonErr(status: number, rid: string, error: string, detail?: string) {
  return NextResponse.json({ ok: false, rid, error, detail }, { status });
}

function csvEscape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const rid = `loc_csv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    const url = new URL(req.url);
    const requestedCompanyId = url.searchParams.get("company_id");

    const companyId =
      scope.role === "superadmin"
        ? requestedCompanyId
          ? String(requestedCompanyId)
          : null
        : mustCompanyId(scope);

    const admin = supabaseAdmin();

    let q = admin
      .from("company_locations")
      .select(
        "id,company_id,name,label,address,address_line1,postal_code,city,delivery_contact_name,delivery_contact_phone,delivery_notes,delivery_window_from,delivery_window_to"
      )
      .order("name", { ascending: true })
      .limit(10000);

    if (companyId) q = q.eq("company_id", companyId);

    const { data: rows, error } = await q;
    if (error) return jsonErr(500, rid, "DB_ERROR", error.message);

    const header = [
      "id",
      "company_id",
      "label",
      "name",
      "address",
      "postal_code",
      "city",
      "delivery_contact_name",
      "delivery_contact_phone",
      "delivery_window_from",
      "delivery_window_to",
      "delivery_notes",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const r of rows ?? []) {
      const line = [
        (r as any).id ?? "",
        (r as any).company_id ?? "",
        (r as any).label ?? "",
        (r as any).name ?? "",
        (r as any).address ?? (r as any).address_line1 ?? "",
        (r as any).postal_code ?? "",
        (r as any).city ?? "",
        (r as any).delivery_contact_name ?? "",
        (r as any).delivery_contact_phone ?? "",
        (r as any).delivery_window_from ?? "",
        (r as any).delivery_window_to ?? "",
        (r as any).delivery_notes ?? "",
      ].map(csvEscape);

      lines.push(line.join(","));
    }

    const csv = lines.join("\n");
    const filename = `locations${companyId ? `_company_${companyId}` : ""}.csv`;

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
    const code = e?.code || "ERROR";
    return jsonErr(status, rid, code, String(e?.message ?? e));
  }
}
