// app/api/admin/employees/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function safeStr(v: any, max = 120) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.slice(0, max);
}

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.min(max, Math.max(min, i));
}

// Join kan komme som object eller array (Supabase/PostgREST)
function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Hent innlogget user + profile og verifiser at han er company_admin.
 * Viktig: company_id hentes fra DB, aldri fra klient.
 */
async function requireCompanyAdmin() {
  const sb = await supabaseServer();

  const {
    data: { user },
    error: uerr,
  } = await sb.auth.getUser();

  if (uerr || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });

  const role = String(user.user_metadata?.role ?? "employee").trim().toLowerCase();
  if (role !== "company_admin") throw Object.assign(new Error("forbidden"), { code: "forbidden" });

  const { data: profile, error: perr } = await sb
    .from("profiles")
    .select("user_id, company_id, role, email, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perr) throw Object.assign(new Error("db_error"), { code: "db_error", detail: perr });
  if (!profile?.company_id) throw Object.assign(new Error("missing_company"), { code: "missing_company" });
  if (String(profile.role ?? "").toLowerCase() !== "company_admin")
    throw Object.assign(new Error("role_mismatch"), { code: "role_mismatch" });

  return { sb, user, profile, companyId: profile.company_id as string };
}

/**
 * ADMIN / EMPLOYEES (company_admin)
 * - only employees (role=employee) in own company
 * - supports:
 *   ?q=        (search name/email/department)
 *   ?page=     (1..)
 *   ?page_size (10..100)
 *   ?sort=     newest|oldest|name
 */
export async function GET(req: NextRequest) {
  const rid = `admin_employees_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { sb, companyId } = await requireCompanyAdmin();

    const url = new URL(req.url);

    const q = safeStr(url.searchParams.get("q"), 80);
    const page = clampInt(url.searchParams.get("page"), 1, 10_000, 1);
    const pageSize = clampInt(url.searchParams.get("page_size"), 10, 100, 25);
    const sort = safeStr(url.searchParams.get("sort"), 20).toLowerCase() as "newest" | "oldest" | "name";

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // base query
    let query = sb
      .from("profiles")
      .select(
        `
        user_id,
        email,
        full_name,
        department,
        location_id,
        role,
        created_at,
        updated_at,
        company_id,
        companies ( id, name ),
        company_locations (
          id,
          name,
          label,
          address,
          address_line1,
          postal_code,
          city
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", companyId)
      .eq("role", "employee")
      .range(from, to);

    // search
    if (q) {
      // PostgREST OR-søk
      // NB: fjern potensielt problemtegn
      const cleaned = q.replace(/[,*]/g, " ").trim();
      const like = `*${cleaned}*`;
      query = query.or(`full_name.ilike.${like},email.ilike.${like},department.ilike.${like}`);
    }

    // sorting
    if (sort === "oldest") query = query.order("created_at", { ascending: true });
    else if (sort === "name") query = query.order("full_name", { ascending: true, nullsFirst: false });
    else query = query.order("created_at", { ascending: false }); // newest default

    const { data: rows, error, count } = await query;

    if (error) return jsonError(500, "employees_read_failed", "Kunne ikke hente ansatte.", error);

    const employees = (rows ?? []).map((r: any) => ({
      user_id: r.user_id,
      email: r.email ?? null,
      full_name: r.full_name ?? null,
      department: r.department ?? null,
      location_id: r.location_id ?? null,
      role: r.role ?? "employee",
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
      company_id: r.company_id ?? null,
      companies: first(r.companies),
      company_locations: first(r.company_locations),
    }));

    return NextResponse.json(
      {
        ok: true,
        rid,
        company_id: companyId,
        q,
        page,
        page_size: pageSize,
        sort: sort || "newest",
        count: count ?? employees.length,
        employees,
      },
      { status: 200 }
    );
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return jsonError(401, "not_authenticated", "Du må være innlogget.");
    if (code === "forbidden") return jsonError(403, "forbidden", "Ingen tilgang.");
    if (code === "missing_company") return jsonError(400, "missing_company", "Mangler company_id på admin-profilen.");
    if (code === "role_mismatch") return jsonError(403, "role_mismatch", "Rolle mismatch mellom auth og profil.");
    if (code === "db_error") return jsonError(500, "db_error", "Databasefeil.", e?.detail);
    return jsonError(500, "server_error", "Uventet feil.", String(e?.message ?? e));
  }
}
