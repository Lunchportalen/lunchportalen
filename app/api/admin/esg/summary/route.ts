// app/api/admin/esg/summary — company_admin: ESG-snapshot fra DB (samme spørring som superadmin/backoffice).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { fetchCompanyEsgSnapshotSummary } from "@/lib/esg/fetchCompanyEsgSnapshotSummary";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

export async function GET(req: NextRequest) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();

  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;
  const ctx = a.ctx;

  const b = requireRoleOr403(ctx, ["company_admin"]);
  if (b instanceof Response) return b;

  const c = requireCompanyScopeOr403(ctx);
  if (c instanceof Response) return c;

  const companyId = String(ctx.scope.companyId);

  try {
    const { year, months, yearly } = await fetchCompanyEsgSnapshotSummary(supabase, companyId);
    return jsonOk(ctx.rid, { companyId, year, months, yearly }, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(ctx.rid, "Kunne ikke hente månedssnapshots.", 500, { code: "db_error", detail: { message: msg } });
  }
}
