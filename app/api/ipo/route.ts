export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { auditLog } from "@/lib/core/audit";
import { withTimeout } from "@/lib/core/timeout";
import { getFinancialReport } from "@/lib/ipo/report";
import { getGovernanceStatus } from "@/lib/ipo/governance";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { opsLog } from "@/lib/ops/log";

function isTimeoutErr(e: unknown): boolean {
  return e instanceof Error && e.message === "TIMEOUT";
}

export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.ipo.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const [report, governance] = await Promise.all([
      withTimeout(getFinancialReport(), 15_000),
      withTimeout(getGovernanceStatus(), 15_000),
    ]);
    opsLog("api_ipo_GET", { rid: gate.ctx.rid, governance: governance.status });
    await auditLog({
      action: "ipo_snapshot_view",
      entity: "ipo",
      metadata: { rid: gate.ctx.rid, arr: report.arr },
    });
    return jsonOk(gate.ctx.rid, { report, governance }, 200);
  } catch (e) {
    if (isTimeoutErr(e)) {
      return jsonErr(gate.ctx.rid, "IPO-modus tok for lang tid (timeout).", 504, "IPO_TIMEOUT", e);
    }
    return jsonErr(gate.ctx.rid, "Kunne ikke hente IPO-modus.", 500, "IPO_FAILED", e);
  }
}
