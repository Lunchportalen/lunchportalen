// FASE 8 — company admin: mottatte fakturaer (kun eget firma, kun utstedte).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { listCompanyInvoices } from "@/lib/billing/invoiceLifecycle";

export async function GET(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;
  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.invoices.read", ["company_admin"]);
  if (denyRole) return denyRole;
  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");

  const invoices = await listCompanyInvoices(companyId);
  return jsonOk(rid, { invoices }, 200);
}
