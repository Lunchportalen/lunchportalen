export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { auditLog } from "@/lib/core/audit";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { runSalesAI } from "@/lib/sales/engine";
import { opsLog } from "@/lib/ops/log";

export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.sales.ai.POST", ["superadmin"]);
  if (deny) return deny;

  try {
    const body = await readJson(req);
    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const leads = o.leads;
    if (!Array.isArray(leads)) {
      return jsonErr(gate.ctx.rid, "leads må være en liste.", 422, "VALIDATION_ERROR");
    }

    const recordRevenueSignals = o.recordRevenueSignals === true;
    const idemHeader = req.headers.get("x-idempotency-key");
    const idempotencyPrefix =
      (typeof o.idempotencyKey === "string" && o.idempotencyKey.trim()) ||
      (idemHeader && idemHeader.trim()) ||
      gate.ctx.rid;

    const results = await runSalesAI(leads, {
      recordRevenueSignals,
      idempotencyPrefix: idempotencyPrefix.slice(0, 120),
    });

    opsLog("api_sales_ai_POST", {
      rid: gate.ctx.rid,
      count: results.length,
      recordRevenueSignals,
    });
    await auditLog({
      action: "sales_ai_run",
      entity: "sales",
      metadata: {
        rid: gate.ctx.rid,
        count: results.length,
        recordRevenueSignals,
      },
    });

    return jsonOk(gate.ctx.rid, { results }, 200);
  } catch (e) {
    return jsonErr(gate.ctx.rid, "Sales AI feilet.", 500, "SALES_AI_FAILED", e);
  }
}
