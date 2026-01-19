// app/api/admin/locations/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope, allowSuperadminOrCompanyAdmin, mustCompanyId } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";

/**
 * ADMIN / LOCATIONS
 * - company_admin: only own company locations
 * - superadmin: can see all OR filter by ?company_id=
 * - Never trust client-provided company_id for company_admin
 */

const SELECT_FIELDS =
  "id,company_id,name,address,delivery_contact_name,delivery_contact_phone,delivery_notes,delivery_window_from,delivery_window_to";

function jsonErr(status: number, error: string, detail?: string) {
  return NextResponse.json({ ok: false, error, detail }, { status });
}

export async function GET(req: NextRequest) {
  try {
    // Auth + scope (tenant lock)
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    const supabase = await supabaseServer();

    const url = new URL(req.url);
    const requestedCompanyId = url.searchParams.get("company_id");

    // company_admin MUST be locked to own company
    const companyId =
      scope.role === "superadmin"
        ? requestedCompanyId // superadmin may choose; if null => all
        : mustCompanyId(scope);

    let q = supabase.from("company_locations").select(SELECT_FIELDS).order("name", { ascending: true });

    if (companyId) q = q.eq("company_id", companyId);

    const { data, error } = await q;
    if (error) return jsonErr(500, "DB_ERROR", error.message);

    return NextResponse.json({ ok: true, locations: data ?? [] }, { status: 200 });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || "ERROR";
    return jsonErr(status, code, e?.message || "Ukjent feil.");
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Auth + scope (tenant lock)
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    const supabase = await supabaseServer();

    const body = await req.json().catch(() => null);
    if (!body?.id) return jsonErr(400, "BAD_REQUEST", "Mangler id.");

    // Read location to enforce scope
    const { data: loc, error: locErr } = await supabase
      .from("company_locations")
      .select("id,company_id")
      .eq("id", body.id)
      .maybeSingle();

    if (locErr) return jsonErr(500, "DB_ERROR", locErr.message);
    if (!loc) return jsonErr(404, "NOT_FOUND", "Lokasjon finnes ikke.");

    // company_admin locked to own company
    if (scope.role !== "superadmin") {
      const myCompanyId = mustCompanyId(scope);
      if (loc.company_id !== myCompanyId) return jsonErr(403, "FORBIDDEN", "Ingen tilgang til denne lokasjonen.");
    }

    // Allow only specific fields to be updated (whitelist)
    const patch = {
      delivery_contact_name: body.delivery_contact_name ?? null,
      delivery_contact_phone: body.delivery_contact_phone ?? null,
      delivery_notes: body.delivery_notes ?? null,
      delivery_window_from: body.delivery_window_from ?? null,
      delivery_window_to: body.delivery_window_to ?? null,
    };

    const { error: updErr } = await supabase.from("company_locations").update(patch).eq("id", body.id);
    if (updErr) return jsonErr(500, "DB_ERROR", updErr.message);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || "ERROR";
    return jsonErr(status, code, e?.message || "Ukjent feil.");
  }
}
