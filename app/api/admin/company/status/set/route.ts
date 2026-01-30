// app/api/admin/company/status/set/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { auditWriteMust } from "@/lib/audit/auditWrite";

/**
 * POST /api/admin/company/status/set
 *
 * Bruk:
 *  - Kun superadmin
 *  - Låser firmastatus sentralt (ACTIVE | PAUSED | CLOSED)
 *  - Fail-closed + MUST audit
 *
 * Body:
 *  {
 *    company_id: string,
 *    status: "ACTIVE" | "PAUSED" | "CLOSED",
 *    reason?: string
 *  }
 */

function safeStr(v: any) {
  return String(v ?? "").trim();
}

type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED";
function normStatus(v: any): CompanyStatus | null {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE" || s === "PAUSED" || s === "CLOSED") return s;
  return null;
}

export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.company.status.set", ["superadmin"]);
  if (denyRole) return denyRole;

  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return jsonErr(500, rid, "CONFIG_ERROR", "Service role mangler.");
  }

  try {
    const body = await readJson(req);

    const company_id = safeStr(body?.company_id);
    const status = normStatus(body?.status);
    const reason = safeStr(body?.reason) || null;

    if (!company_id) return jsonErr(400, rid, "MISSING_COMPANY", "Mangler company_id.");
    if (!status) return jsonErr(400, rid, "INVALID_STATUS", "Ugyldig status.");

    // hent eksisterende
    const { data: existing, error: exErr } = await admin
      .from("companies")
      .select("id,status")
      .eq("id", company_id)
      .maybeSingle();

    if (exErr || !existing) {
      return jsonErr(404, rid, "COMPANY_NOT_FOUND", "Fant ikke firma.", {
        message: exErr?.message ?? null,
      });
    }

    // no-op guard
    if (safeStr(existing.status).toUpperCase() === status) {
      return jsonOk({
        ok: true,
        rid,
        company_id,
        status,
        unchanged: true,
      });
    }

    const { error: upErr } = await admin
      .from("companies")
      .update({ status })
      .eq("id", company_id);

    if (upErr) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke oppdatere firmastatus.", {
        message: upErr.message,
      });
    }

    // MUST audit
    await auditWriteMust({
      rid,
      action: "COMPANY_STATUS_SET",
      entity_type: "company",
      entity_id: company_id,
      company_id,
      location_id: null,
      actor_user_id: safeStr(scope.userId),
      actor_email: scope.email ?? null,
      actor_role: scope.role ?? null,
      summary: `Company status ${status}`,
      detail: {
        before: safeStr(existing.status).toUpperCase(),
        after: status,
        reason,
      },
    });

    return jsonOk({
      ok: true,
      rid,
      company_id,
      status,
    });
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", String(e?.message ?? e), { at: "admin/company/status/set" });
  }
}
