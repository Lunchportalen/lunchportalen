export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { fetchCompanyEsgSnapshotSummary } from "@/lib/esg/fetchCompanyEsgSnapshotSummary";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) return jsonErr(ctx.rid, "company_id mangler", 400, "BAD_REQUEST");

  const supabase = await supabaseServer();

  try {
    const { year, months, yearly } = await fetchCompanyEsgSnapshotSummary(supabase, companyId);
    return jsonOk(ctx.rid, { company_id: companyId, year, months, yearly });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(ctx.rid, "Kunne ikke hente månedssnapshots", 500, "DB_ERROR", { detail: msg });
  }
}
