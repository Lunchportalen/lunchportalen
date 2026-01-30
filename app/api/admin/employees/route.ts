// app/api/admin/employees/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

// ✅ Dag-10 helpers
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

type AllowedRole = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
const allowedRoles = ["company_admin", "superadmin"] as const satisfies readonly AllowedRole[];

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function getQueryParam(url: string, key: string) {
  try {
    return new URL(url).searchParams.get(key);
  } catch {
    return null;
  }
}

type AnyRow = Record<string, any>;

function pickEmployee(row: AnyRow) {
  const name =
    safeStr(row.full_name) ||
    safeStr(row.name) ||
    safeStr(row.navn) ||
    safeStr(row.display_name) ||
    "";

  const department = safeStr(row.department) || safeStr(row.avdeling) || null;
  const phone = safeStr(row.phone) || safeStr(row.telefon) || null;

  return {
    id: safeStr(row.id) || null,
    email: safeStr(row.email) || null,
    name: name || null,
    department,
    phone,
    role: safeStr(row.role) || null,
    company_id: safeStr(row.company_id) || null,
    location_id: safeStr(row.location_id) || null,
    disabled_at: row.disabled_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function GET(req: NextRequest) {
  // 🔐 401 (NY SIGNATUR: Response | { ok:true, ctx })
  const s = await scopeOr401(req);
  if (s instanceof Response) return s;
  const ctx = s.ctx;

  // 🔐 403 role gate (NY SIGNATUR)
  const denyRole = requireRoleOr403(ctx, "admin.employees.read", ["company_admin", "superadmin"]);
  if (denyRole) return denyRole;

  // Company scope:
  // - company_admin: låst til ctx.scope.companyId
  // - superadmin: kan (valgfritt) sende ?companyId=... for å filtrere
  const isSuper = safeStr(ctx.scope.role) === "superadmin";
  const qCompanyId = safeStr(getQueryParam(req.url, "companyId")) || null;

  let companyId: string | null = null;

  if (isSuper) {
    companyId = qCompanyId || safeStr(ctx.scope.companyId) || null;
  } else {
    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;
    companyId = safeStr(ctx.scope.companyId) || null;
  }

  if (!companyId) {
    return jsonErr(ctx, "bad_request", "Mangler companyId i scope.", {
      hint: "Company admin må ha companyId. Superadmin kan bruke ?companyId=...",
    });
  }

  try {
    const sb = supabaseAdmin();

    // Robust: select("*") så vi ikke bommer på kolonnenavn og knekker builden.
    let q = sb.from("profiles").select("*").eq("company_id", companyId);

    // Exclude superadmin system-profiler fra listen
    q = q.neq("role", "superadmin");

    const { data, error } = await q;

    if (error) {
      return jsonErr(ctx, "db_error", "Kunne ikke hente ansatte.", {
        code: (error as any).code ?? null,
        message: (error as any).message ?? String(error),
        detail: (error as any).details ?? null,
        hint: (error as any).hint ?? null,
      });
    }

    const rows = Array.isArray(data) ? data : [];
    const items = rows.map(pickEmployee);

    return jsonOk(ctx, { ok: true, companyId, items });
  } catch (err: unknown) {
    const detail = err instanceof Error ? { name: err.name, message: err.message } : { err };
    return jsonErr(ctx, "internal_error", "Uventet feil i employees-route.", detail);
  }
}

export async function POST(req: NextRequest) {
  // 🔐 401
  const s = await scopeOr401(req);
  if (s instanceof Response) return s;
  const ctx = s.ctx;

  // 🔐 403
  const denyRole = requireRoleOr403(ctx, "admin.employees.post", ["company_admin", "superadmin"]);
  if (denyRole) return denyRole;

  // 405 (låst)
  return jsonErr(ctx, "method_not_allowed", "Bruk /admin/employees/invite, /resend eller /set-disabled.", {
    method: "POST",
    route: "/api/admin/employees",
  });
}
