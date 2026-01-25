// app/api/admin/employees/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope, allowSuperadminOrCompanyAdmin, mustCompanyId } from "@/lib/auth/scope";

/**
 * ADMIN / EMPLOYEES
 * - company_admin: only employees in own company
 * - superadmin: can see all OR filter by ?company_id=
 * - Never trust client-provided company_id for company_admin
 *
 * GET -> list employees (paged) + optional counts
 */

const SELECT_FIELDS = "user_id,email,role,company_id,location_id,department,disabled_at,created_at,updated_at";

function jsonErr(status: number, error: string, detail?: string, extra?: any) {
  return NextResponse.json(
    { ok: false, error, detail: detail ?? undefined, extra: extra ?? undefined },
    { status }
  );
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function asInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeQ(v: any, max = 120) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.slice(0, max);
}

function resolveCompanyId(scope: any, req: NextRequest) {
  const url = new URL(req.url);
  const requestedCompanyId = url.searchParams.get("company_id");

  if (scope.role === "superadmin") {
    if (!requestedCompanyId) return null; // null => all
    const v = String(requestedCompanyId).trim();
    if (!v) return null;
    if (!isUuid(v)) throw Object.assign(new Error("Ugyldig company_id i query."), { status: 400, code: "BAD_REQUEST" });
    return v;
  }

  return mustCompanyId(scope); // locked to own
}

export async function GET(req: NextRequest) {
  const rid = `admin_employees_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Auth + scope
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    // Service role for stable reads
    const admin = supabaseAdmin();

    const companyId = resolveCompanyId(scope, req);

    const url = new URL(req.url);
    const q = safeQ(url.searchParams.get("q"));
    const page = clamp(asInt(url.searchParams.get("page"), 1), 1, 99999);
    const pageSize = clamp(asInt(url.searchParams.get("pageSize"), 25), 5, 50);
    const includeCounts = String(url.searchParams.get("counts") ?? "").toLowerCase() === "1";

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // LIST query (fresh builder, no reuse)
    let listQ = admin
      .from("profiles")
      .select(SELECT_FIELDS, { count: "exact" })
      .eq("role", "employee")
      .order("created_at", { ascending: false });

    if (companyId) listQ = listQ.eq("company_id", companyId);

    if (q) {
      listQ = listQ.or(`email.ilike.%${q}%,department.ilike.%${q}%`);
    }

    const { data, error, count } = await listQ.range(from, to);
    if (error) return jsonErr(500, "DB_ERROR", error.message, { rid });

    // Optional counts (fresh builders every time; no chaining reuse)
    let counts: { total: number; active: number; disabled: number } | null = null;

    if (includeCounts) {
      // TOTAL
      let totalQ = admin
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "employee");
      if (companyId) totalQ = totalQ.eq("company_id", companyId);
      const totalRes = await totalQ;
      if (totalRes.error) return jsonErr(500, "DB_ERROR", totalRes.error.message, { rid, step: "counts_total" });

      // ACTIVE (disabled_at is null)
      let activeQ = admin
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "employee")
        .is("disabled_at", null);
      if (companyId) activeQ = activeQ.eq("company_id", companyId);
      const activeRes = await activeQ;
      if (activeRes.error) return jsonErr(500, "DB_ERROR", activeRes.error.message, { rid, step: "counts_active" });

      // DISABLED (disabled_at is not null)
      let disabledQ = admin
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "employee")
        .not("disabled_at", "is", null);
      if (companyId) disabledQ = disabledQ.eq("company_id", companyId);
      const disabledRes = await disabledQ;
      if (disabledRes.error) return jsonErr(500, "DB_ERROR", disabledRes.error.message, { rid, step: "counts_disabled" });

      counts = {
        total: Number(totalRes.count ?? 0),
        active: Number(activeRes.count ?? 0),
        disabled: Number(disabledRes.count ?? 0),
      };
    }

    // Actor info (best effort)
    let actor: { email: string | null; role: string; company_id: string | null } | null = null;
    try {
      const sb = await supabaseServer();
      const { data: au } = await sb.auth.getUser();
      actor = { email: au?.user?.email ?? null, role: scope.role, company_id: companyId };
    } catch {}

    return NextResponse.json(
      {
        ok: true,
        rid,
        company_id: companyId,
        page,
        pageSize,
        total: Number(count ?? 0),
        q: q || null,
        counts,
        actor,
        employees: data ?? [],
      },
      { status: 200 }
    );
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || "ERROR";
    return jsonErr(status, code, e?.message || "Ukjent feil.", { rid });
  }
}
