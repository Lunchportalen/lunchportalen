// app/api/admin/people/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

type CompanyRow = {
  id: string;
  name: string | null;
  status: string | null;
  updated_at: string | null;
};

type EmployeeRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  name: string | null;
  role: string | null;
  department: string | null;
  location_id: string | null;
  disabled_at: string | null;
  is_active: boolean | null;
  phone: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  location_id: string | null;
  created_at: string | null;
  last_sent_at: string | null;
  expires_at: string | null;
  used_at: string | null;
};

export async function GET(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.people.read", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const admin = supabaseAdmin();

  try {
    const url = new URL(req.url);
    const limitRaw = safeStr(url.searchParams.get("inviteLimit"));
    const inviteLimit = Math.min(Math.max(Number(limitRaw || 300), 50), 1000);

    const nowIso = new Date().toISOString();

    const companyQ = admin
      .from("companies")
      .select("id,name,status,updated_at")
      .eq("id", companyId)
      .maybeSingle<CompanyRow>();

    const employeesQ = admin
      .from("profiles")
      .select(
        "id,email,full_name,name,role,department,location_id,disabled_at,is_active,phone,created_at,updated_at"
      )
      .eq("company_id", companyId)
      .eq("role", "employee")
      .order("created_at", { ascending: false });

    const invitesQ = admin
      .from("employee_invites")
      .select("id,email,full_name,department,location_id,created_at,last_sent_at,expires_at,used_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(inviteLimit);

    const [companyRes, employeesRes, invitesRes] = await Promise.all([companyQ, employeesQ, invitesQ]);

    if (companyRes.error)
      return jsonErr(rid, "Kunne ikke hente firma.", 500, { code: "DB_ERROR", detail: { message: companyRes.error.message } });
    if (employeesRes.error)
      return jsonErr(rid, "Kunne ikke hente ansatte.", 500, { code: "DB_ERROR", detail: { message: employeesRes.error.message } });
    if (invitesRes.error)
      return jsonErr(rid, "Kunne ikke hente invitasjoner.", 500, { code: "DB_ERROR", detail: { message: invitesRes.error.message } });

    const company = (companyRes.data ?? null) as CompanyRow | null;
    const employees = ((employeesRes.data ?? []) as EmployeeRow[]).map((row) => ({
      user_id: safeStr(row.id) || null,
      email: safeStr(row.email) || null,
      name: safeStr(row.full_name) || safeStr(row.name) || null,
      full_name: safeStr(row.full_name) || null,
      role: safeStr(row.role) || null,
      department: safeStr(row.department) || null,
      location_id: safeStr(row.location_id) || null,
      disabled_at: row.disabled_at ?? null,
      is_active: typeof row.is_active === "boolean" ? row.is_active : null,
      phone: safeStr(row.phone) || null,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
    }));

    const counts = {
      total: employees.length,
      active: employees.filter((r) => !r.disabled_at && r.is_active !== false).length,
      deactivated: employees.filter((r) => !!r.disabled_at).length,
    };

    const invites = ((invitesRes.data ?? []) as InviteRow[]).map((row) => ({
      id: safeStr(row.id),
      email: safeStr(row.email),
      full_name: safeStr(row.full_name) || null,
      department: safeStr(row.department) || null,
      location_id: safeStr(row.location_id) || null,
      created_at: row.created_at ?? null,
      last_sent_at: row.last_sent_at ?? null,
      expires_at: row.expires_at ?? null,
      used_at: row.used_at ?? null,
    }));

    const inviteCounts = invites.reduce(
      (acc, r) => {
        acc.total += 1;
        if (r.used_at) {
          acc.used += 1;
          return acc;
        }
        const exp = r.expires_at ? new Date(r.expires_at).getTime() : NaN;
        if (Number.isFinite(exp) && exp < new Date(nowIso).getTime()) acc.expired += 1;
        else acc.active += 1;
        return acc;
      },
      { total: 0, active: 0, used: 0, expired: 0 }
    );

    return jsonOk(a.ctx.rid, {
      company: company
        ? {
            id: safeStr(company.id),
            name: safeStr(company.name) || null,
            status: safeStr(company.status) || null,
            updated_at: company.updated_at ?? null,
          }
        : null,
      employees,
      counts,
      invites,
      inviteCounts,
      source: {
        companyId,
        updatedAt: company?.updated_at ?? null,
      },
    });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, { code: "UNHANDLED", detail: { message: String(e?.message ?? e) } });
  }
}

