export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { fetchCompanyEsgSnapshotSummary } from "@/lib/esg/fetchCompanyEsgSnapshotSummary";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const url = new URL(req.url);
  const companyId = url.searchParams.get("company_id");
  if (!companyId) {
    return jsonErr(gate.ctx.rid, "company_id mangler", 400, "BAD_REQUEST");
  }

  const supabase = await supabaseServer();

  try {
    const { year, months, yearly } = await fetchCompanyEsgSnapshotSummary(supabase, companyId);
    return jsonOk(gate.ctx.rid, { company_id: companyId, year, months, yearly }, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(gate.ctx.rid, "Kunne ikke hente ESG-snapshots.", 500, "DB_ERROR", { detail: msg });
  }
}
