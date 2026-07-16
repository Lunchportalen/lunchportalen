// Fase 5: fakturaprofil for company_admin — fakturamottaker, adresse,
// fakturareferanse, kostnadssted og ansattantall. Scoped til eget firma.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

const FIELDS =
  "id, name, billing_email, billing_address, billing_postcode, billing_city, billing_country, invoice_reference, cost_center, employee_count, ehf_enabled, legal_name";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function GET(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;
  const denyRole = requireRoleOr403(a.ctx, "admin.company.billing.read", ["company_admin"]);
  if (denyRole) return denyRole;
  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const admin = supabaseAdmin();
  const { data, error } = await (admin as any).from("companies").select(FIELDS).eq("id", companyId).maybeSingle();
  if (error || !data) return jsonErr(rid, "Kunne ikke hente fakturaprofil.", 500, "BILLING_READ_FAILED");

  return jsonOk(rid, { billing: data }, 200);
}

export async function PUT(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;
  const denyRole = requireRoleOr403(a.ctx, "admin.company.billing.update", ["company_admin"]);
  if (denyRole) return denyRole;
  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = safeStr(scope.companyId);
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const body = ((await readJson(req)) ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ("billing_email" in body) {
    const email = safeStr(body.billing_email).toLowerCase();
    if (email && !isEmail(email)) return jsonErr(rid, "Fakturamottaker må være en gyldig e-post.", 422, "BILLING_EMAIL_INVALID");
    patch.billing_email = email || null;
  }
  if ("billing_address" in body) patch.billing_address = safeStr(body.billing_address).slice(0, 300) || null;
  if ("billing_postcode" in body) {
    const pc = safeStr(body.billing_postcode);
    if (pc && !/^\d{4}$/.test(pc)) return jsonErr(rid, "Postnummer må være 4 siffer.", 422, "BILLING_POSTCODE_INVALID");
    patch.billing_postcode = pc || null;
  }
  if ("billing_city" in body) patch.billing_city = safeStr(body.billing_city).slice(0, 120) || null;
  if ("invoice_reference" in body) patch.invoice_reference = safeStr(body.invoice_reference).slice(0, 120) || null;
  if ("cost_center" in body) patch.cost_center = safeStr(body.cost_center).slice(0, 120) || null;
  if ("employee_count" in body) {
    const n = Number(body.employee_count);
    if (!Number.isFinite(n) || Math.trunc(n) < 20) {
      return jsonErr(rid, "Antall ansatte må være minst 20.", 422, "EMPLOYEE_COUNT_MIN_20");
    }
    patch.employee_count = Math.trunc(n);
  }

  if (Object.keys(patch).length === 0) return jsonErr(rid, "Ingen felter å oppdatere.", 400, "NO_FIELDS");
  patch.updated_at = new Date().toISOString();

  const admin = supabaseAdmin();
  const upd = await (admin as any).from("companies").update(patch).eq("id", companyId).select("id").maybeSingle();
  if (upd.error || !upd.data?.id) return jsonErr(rid, "Kunne ikke lagre fakturaprofil.", 500, "BILLING_UPDATE_FAILED");

  try {
    const { auditLog } = await import("@/lib/audit/log");
    auditLog({
      action: "COMPANY_BILLING_UPDATED",
      userId: safeStr(scope.userId) || null,
      role: "company_admin",
      companyId,
      locationId: null,
      resource: "company_billing",
      resourceId: companyId,
      metadata: { rid, fields: Object.keys(patch).filter((k) => k !== "updated_at") },
      timestamp: Date.now(),
      rid,
    });
  } catch {
    // audit best-effort
  }

  return jsonOk(rid, { updated: Object.keys(patch).filter((k) => k !== "updated_at") }, 200);
}
