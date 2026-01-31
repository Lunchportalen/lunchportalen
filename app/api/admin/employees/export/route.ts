// app/api/admin/employees/export/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { rid as makeRid } from "@/lib/http/respond";

function csvEscape(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoToNO(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yy} ${hh}:${mi}`;
}

function noStoreHeaders(rid: string) {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "x-lp-rid": rid,
  } as const;
}

// Join kan komme som object eller array (PostgREST)
function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();

  // 401 gate
  const s = await scopeOr401(req);
  if (s instanceof Response) return s;
  const ctx = s.ctx;

  // 403 gate (superadmin OR company_admin)
  const rg = requireRoleOr403(ctx, ["superadmin", "company_admin"]);
  if (rg instanceof Response) return rg;

  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") ?? "").trim().slice(0, 80);

  // superadmin kan velge company_id, ellers egen companyId
  const requestedCompanyId = String(url.searchParams.get("company_id") ?? "").trim() || null;

  let companyId: string | null = null;
  if (String((ctx as any)?.role ?? "") === "superadmin") {
    companyId = requestedCompanyId; // null = alle firma
  } else {
    const cg = requireCompanyScopeOr403(ctx);
    if (cg instanceof Response) return cg;
    companyId = String((cg as any).companyId ?? "") || null;
  }

  try {
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
      // ilike med %...% (ikke "*" – det er fulltext-operator, ikke ilike)
      const cleaned = q.replace(/[%_*]/g, " ").trim();
      const like = `%${cleaned}%`;
      query = query.or(`full_name.ilike.${like},email.ilike.${like},department.ilike.${like}`);
    }

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, rid, error: "EMPLOYEES_READ_FAILED", message: "Kunne ikke hente ansatte.", detail: error },
        { status: 500, headers: noStoreHeaders(rid) }
      );
    }

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
      const comp = first((r as any).companies);
      const loc = first((r as any).company_locations);

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
        (comp as any)?.name ?? "",
        (r as any).location_id ?? "",
        (loc as any)?.label ?? "",
        (loc as any)?.name ?? "",
        (loc as any)?.postal_code ?? "",
        (loc as any)?.city ?? "",
        String(((loc as any)?.address ?? (loc as any)?.address_line1 ?? "") as string),
      ].map(csvEscape);

      lines.push(line.join(","));
    }

    const csv = lines.join("\n");
    const suffix = companyId ? `_company_${companyId}` : "";
    const filename = `employees${suffix}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        ...noStoreHeaders(rid),
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return NextResponse.json(
      { ok: false, rid, error: code, message: "Uventet feil.", detail: String(e?.message ?? e) },
      { status, headers: noStoreHeaders(rid) }
    );
  }
}


