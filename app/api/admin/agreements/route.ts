// app/api/admin/agreements/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getScope, allowSuperadminOrCompanyAdmin, mustCompanyId } from "@/lib/auth/scope";

function jsonErr(status: number, rid: string, error: string, detail?: string) {
  return NextResponse.json({ ok: false, rid, error, detail }, { status });
}

/**
 * ADMIN / AGREEMENTS
 * - company_admin: only own company agreement
 * - superadmin: can fetch/update any company agreement using ?company_id=
 * - Never trust client-provided company_id unless superadmin
 *
 * Assumes table: public.company_agreements (recommended) with:
 *   - id (uuid)
 *   - company_id (uuid) UNIQUE (one agreement per company)
 *   - plan_tier (text) e.g. BASIS/LUXUS
 *   - basis_days_per_week (int) (optional)
 *   - luxus_days_per_week (int) (optional)
 *   - price_basis (int) default 90 (optional)
 *   - price_luxus (int) default 130 (optional)
 *   - start_date, end_date (date) (optional)
 *   - status (text) Active/Paused/Closed (optional)
 *   - notes (text) (optional)
 *
 * If your table name differs, change TABLE below.
 */

const TABLE = "company_agreements";

const SELECT_FIELDS = `
  id,
  company_id,
  plan_tier,
  basis_days_per_week,
  luxus_days_per_week,
  price_basis,
  price_luxus,
  start_date,
  end_date,
  status,
  notes,
  updated_at,
  created_at
`;

function normalizeTier(v: any) {
  const s = String(v ?? "").toUpperCase().trim();
  if (!s) return null;
  if (!["BASIS", "LUXUS"].includes(s)) throw new Error("Ugyldig plan_tier. Bruk BASIS eller LUXUS.");
  return s;
}

function toIntOrNull(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("Ugyldig tallverdi.");
  return Math.trunc(n);
}

function toDateOrNull(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  // Basic ISO date check YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Ugyldig datoformat. Bruk YYYY-MM-DD.");
  return s;
}

export async function GET(req: NextRequest) {
  const rid = `admin_agreements_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Auth + scope lock
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    const url = new URL(req.url);
    const requestedCompanyId = url.searchParams.get("company_id");

    const companyId =
      scope.role === "superadmin"
        ? (requestedCompanyId ? String(requestedCompanyId) : null)
        : mustCompanyId(scope);

    if (scope.role === "superadmin" && !companyId) {
      // Keep superadmin safe/explicit here: require company_id
      return jsonErr(400, rid, "BAD_REQUEST", "Superadmin må angi ?company_id= for avtaleoppslag.");
    }

    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT_FIELDS)
      .eq("company_id", companyId!)
      .maybeSingle();

    if (error) return jsonErr(500, rid, "AGREEMENT_READ_FAILED", error.message);

    return NextResponse.json({ ok: true, rid, company_id: companyId, agreement: data ?? null }, { status: 200 });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(status, rid, code, String(e?.message ?? e));
  }
}

export async function PUT(req: NextRequest) {
  const rid = `admin_agreements_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Auth + scope lock
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    const url = new URL(req.url);
    const requestedCompanyId = url.searchParams.get("company_id");

    const companyId =
      scope.role === "superadmin"
        ? (requestedCompanyId ? String(requestedCompanyId) : null)
        : mustCompanyId(scope);

    if (scope.role === "superadmin" && !companyId) {
      return jsonErr(400, rid, "BAD_REQUEST", "Superadmin må angi ?company_id= for å oppdatere avtale.");
    }

    const body = await req.json().catch(() => null);
    if (!body) return jsonErr(400, rid, "BAD_REQUEST", "Mangler body.");

    // Whitelist patch fields (enterprise safe)
    const patch: Record<string, any> = {};

    if ("plan_tier" in body) patch.plan_tier = normalizeTier(body.plan_tier);
    if ("basis_days_per_week" in body) patch.basis_days_per_week = toIntOrNull(body.basis_days_per_week);
    if ("luxus_days_per_week" in body) patch.luxus_days_per_week = toIntOrNull(body.luxus_days_per_week);

    if ("price_basis" in body) patch.price_basis = toIntOrNull(body.price_basis);
    if ("price_luxus" in body) patch.price_luxus = toIntOrNull(body.price_luxus);

    if ("start_date" in body) patch.start_date = toDateOrNull(body.start_date);
    if ("end_date" in body) patch.end_date = toDateOrNull(body.end_date);

    if ("status" in body) patch.status = body.status ?? null;
    if ("notes" in body) patch.notes = body.notes ?? null;

    // Require something to update
    if (Object.keys(patch).length === 0) {
      return jsonErr(400, rid, "BAD_REQUEST", "Ingen gyldige felter å oppdatere.");
    }

    // Use admin client for robust upsert even if RLS changes,
    // but still enforce company scope strictly in code.
    const admin = supabaseAdmin();

    // Upsert one agreement per company (requires UNIQUE(company_id) in table)
    const { data, error } = await (admin as any)
      .from(TABLE)
      .upsert(
        {
          company_id: companyId!,
          ...patch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      )
      .select(SELECT_FIELDS)
      .single();

    if (error) return jsonErr(500, rid, "AGREEMENT_UPDATE_FAILED", error.message);

    return NextResponse.json({ ok: true, rid, company_id: companyId, agreement: data }, { status: 200 });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || (status === 401 ? "UNAUTH" : "SERVER_ERROR");
    return jsonErr(status, rid, code, String(e?.message ?? e));
  }
}
