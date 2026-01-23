// app/api/admin/employees/export/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getScope, allowSuperadminOrCompanyAdmin, mustCompanyId } from "@/lib/auth/scope";

function csvEscape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function jsonErr(status: number, rid: string, error: string, detail?: string) {
  return NextResponse.json({ ok: false, rid, error, detail }, { status });
}

function isoToNO(iso: string | null | undefined) {
  if (!iso) return "";
  // for created_at/updated_at/disabled_at bruker vi DD-MM-YYYY HH:MM (NB: ikke timezone-magi her)
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yy} ${hh}:${mi}`;
}

export async function GET(req: NextRequest) {
  const rid = `admin_employees_csv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const url = new URL(req.url);

    // optional: søk (samme som i liste-endpoint)
    const q = String(url.searchParams.get("q") ?? "").trim().slice(0, 80);

    // superadmin kan velge company_id, admin får egen
    const requestedCompanyId = url.searchParams.get("company_id");

    // scope
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    const companyId =
      scope.role === "superadmin"
        ? requestedCompanyId
          ? String(requestedCompanyId)
          : null
        : mustCompanyId(scope);

    const admin = supabaseAdmin();

    let query = admin
      .from("profiles")
      .select(
        `
        user_id,
        email,
        full_name,
        department,
        role,
        company_id,
        location_id,
        created_at,
        updated_at,
        disabled_at,
        companies ( id, name ),
        company_locations ( id, name, label, postal_code, city, address, address_line1 )
      `
      )
      .eq("role", "employee")
      .order("created_at", { ascending: false })
      .limit(10000);

    if (companyId) query = query.eq("company_id", companyId);

    if (q) {
      const cleaned = q.replace(/[,*]/g, " ").trim();
      const like = `*${cleaned}*`;
      query = query.or(`full_name.ilike.${like},email.ilike.${like},department.ilike.${like}`);
    }

    const { data: rows, error } = await query;
    if (error) return jsonErr(500, rid, "EMPLOYEES_READ_FAILED", error.message);

    const norm = (v: any) => (Array.isArray(v) ? v[0] ?? null : v ?? null);

    const header = [
      "user_id",
      "email",
      "full_name",
      "department",
      "status", // Active/Disabled
      "disabled_at",
      "created_at",
      "updated_at",
      "company_id",
      "company_name",
      "location_id",
      "location_label",
      "location_name",
      "postal_code",
      "city",
      "address",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const r of rows ?? []) {
      const comp = norm((r as any).companies);
      const loc = norm((r as any).company_locations);

      const disabledAt = (r as any).disabled_at ?? null;
      const status = disabledAt ? "Disabled" : "Active";

      const line = [
        (r as any).user_id ?? "",
        (r as any).email ?? "",
        (r as any).full_name ?? "",
        (r as any).department ?? "",
        status,
        isoToNO(disabledAt),
        isoToNO((r as any).created_at),
        isoToNO((r as any).updated_at),
        (r as any).company_id ?? "",
        comp?.name ?? "",
        (r as any).location_id ?? "",
        loc?.label ?? "",
        loc?.name ?? "",
        loc?.postal_code ?? "",
        loc?.city ?? "",
        (loc?.address ?? loc?.address_line1 ?? "") as string,
      ].map(csvEscape);

      lines.push(line.join(","));
    }

    const csv = lines.join("\n");

    const suffix = companyId ? `_company_${companyId}` : "";
    const filename = `employees${suffix}.csv`;

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
