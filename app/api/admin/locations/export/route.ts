// app/api/admin/locations/export/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 helpers
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { jsonErr } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";

function csvEscape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function csvResponse(csv: string, filename: string, rid: string) {
  const headers = {
    ...noStoreHeaders(),
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`,
    "x-lp-rid": rid,
  } as Record<string, string>;

  return new Response(csv, { status: 200, headers });
}

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // 1) Scope (NY SIGNATUR: Response | { ok:true, ctx })
  const a = await scopeOr401(req);
  if (a instanceof Response) return a;
  const ctx = a.ctx;

  // 2) Roles: superadmin OR company_admin (NY SIGNATUR)
  const denyRole = requireRoleOr403(ctx, "admin.locations.export", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  // 3) company scope:
  // - company_admin: låst til egen companyId
  // - superadmin: kan eksportere alle eller filtrere på ?company_id=
  const url = new URL(req.url);
  const requestedCompanyId = safeStr(url.searchParams.get("company_id")) || null;

  const role = safeStr(ctx.scope.role);
  const ctxCompanyId = safeStr(ctx.scope.companyId);

  let companyId: string | null = null;

  if (role === "superadmin") {
    companyId = requestedCompanyId || null; // null => alle
  } else {
    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;
    companyId = ctxCompanyId || null;
    if (!companyId) return jsonErr(ctx, "missing_company", "Mangler company_id i scope.");
  }

  try {
    const admin = supabaseAdmin();

    // Schema-fast select (som før). Hvis dere får 42703, bytt til "*" og fallback-map.
    let q = admin
      .from("company_locations")
      .select(
        "id,company_id,name,label,address,address_line1,postal_code,city,delivery_contact_name,delivery_contact_phone,delivery_notes,delivery_window_from,delivery_window_to"
      )
      .order("name", { ascending: true })
      .limit(10000);

    if (companyId) q = q.eq("company_id", companyId);

    const { data: rows, error } = await q;

    if (error) {
      return jsonErr(ctx, "locations_export_failed", "Databasefeil.", {
        code: (error as any).code ?? null,
        message: (error as any).message ?? String(error),
        detail: (error as any).details ?? null,
        hint: (error as any).hint ?? null,
      });
    }

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

    return csvResponse(csv, filename, ctx.rid);
  } catch (e: any) {
    return jsonErr(ctx, "server_error", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}


