// FASE 8 — company admin: fakturadetalj (kun eget firma, aldri utkast).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { loadInvoiceWithLines } from "@/lib/billing/invoiceLifecycle";

type Ctx = { params: { invoiceId: string } | Promise<{ invoiceId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;
  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.invoices.read", ["company_admin"]);
  if (denyRole) return denyRole;
  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const params = await Promise.resolve(ctx.params as any);
  const invoiceId = String(params?.invoiceId ?? "").trim();
  const companyId = String(scope.companyId ?? "").trim();

  const bundle = await loadInvoiceWithLines(invoiceId);
  // Tenant law: eget firma og aldri provider-utkast/annullert — ellers 404.
  if (!bundle || bundle.head.company_id !== companyId || bundle.head.status === "DRAFT" || bundle.head.status === "VOID") {
    return jsonErr(rid, "Fakturaen finnes ikke.", 404, "INVOICE_NOT_FOUND");
  }
  return jsonOk(rid, bundle, 200);
}
