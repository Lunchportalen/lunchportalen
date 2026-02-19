// app/api/admin/employees/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";
import type { NextRequest } from "next/server";

// ✅ Dag-10 helpers
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
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
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  // 🔐 401 (NY SIGNATUR: Response | { ok:true, ctx })
  const s = await scopeOr401(req);
  if (s.ok === false) return s.res;
  const ctx = s.ctx;

  // 🔐 403 role gate (NY SIGNATUR)
  const denyRole = requireRoleOr403(ctx, "admin.employees.read", ["company_admin", "superadmin"]);
  if (denyRole) return denyRole;

  // Company scope: låst til ctx.scope.companyId (du sa: for alle roller)
  const denyScope = requireCompanyScopeOr403(ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(ctx.scope.companyId) || null;
  if (!companyId) {
    return jsonErr(ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
  }

  try {
    const sb = supabaseAdmin();

    // Robust: select("*") så vi ikke bommer på kolonnenavn og knekker builden.
    let q = sb.from("profiles").select("*").eq("company_id", companyId);

    // Exclude superadmin system-profiler fra listen
    q = q.neq("role", "superadmin");

    const { data, error } = await q;

    if (error) {
      return jsonErr(ctx.rid, "Kunne ikke hente ansatte.", 500, {
        code: "EMPLOYEES_DB_ERROR",
        detail: {
          code: (error as any).code ?? null,
          message: (error as any).message ?? String(error),
          detail: (error as any).details ?? null,
          hint: (error as any).hint ?? null,
        },
      });
    }

    const rows = Array.isArray(data) ? data : [];
    const items = rows.map(pickEmployee);

    // ✅ Enterprise-flat payload (client kan lese direkte)
    return jsonOk(
      ctx.rid,
      {
        companyId,
        count: items.length,
        items,
      },
      200
    );
  } catch (err: unknown) {
    const detail =
      err instanceof Error ? { name: err.name, message: err.message } : { err };

    return jsonErr(ctx.rid, "Uventet feil i employees-route.", 500, {
      code: "EMPLOYEES_UNHANDLED",
      detail,
    });
  }
}

export async function POST(req: NextRequest) {
  const s = await scopeOr401(req);
  if (s.ok === false) return s.res;
  const ctx = s.ctx;

  const denyRole = requireRoleOr403(ctx, "admin.employees.post", ["company_admin", "superadmin"]);
  if (denyRole) return denyRole;

  // ✅ Riktig status: 405
  return jsonErr(ctx.rid, "Bruk /admin/employees/invite, /resend eller /set-disabled.", 405, {
    code: "METHOD_NOT_ALLOWED",
    detail: {
      method: "POST",
      route: "/api/admin/employees",
    },
  });
}
