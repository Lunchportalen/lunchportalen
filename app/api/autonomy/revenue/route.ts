export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runRevenueAutopilotLoop } from "@/lib/autonomy/runRevenue";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runInstrumentedApi } from "@/lib/http/withObservability";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { opsLog } from "@/lib/ops/log";
import { autonomyRevenueBodySchema } from "@/lib/validation/schemas";
import { parseValidatedJson } from "@/lib/validation/withValidation";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * POST: kjør lukket omsetningsløyfe (superadmin). Krever companyId/userId for AI-generering.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("autonomy_revenue");

  return runInstrumentedApi(req, { rid, route: "/api/autonomy/revenue" }, async () => {
    let dryRun = false;
    let companyId = safeStr(process.env.REVENUE_AUTOPILOT_COMPANY_ID);
    let userId = safeStr(gate.ctx.scope.userId);

    const parsed = await parseValidatedJson(autonomyRevenueBodySchema, req, rid);
    if (parsed.ok === false) return parsed.response;

    const body = parsed.data;
    if (body.dryRun === true) dryRun = true;
    const c = safeStr(body.companyId);
    const u = safeStr(body.userId);
    if (c) companyId = c;
    if (u) userId = u;

    if (!companyId || !userId) {
      return jsonErr(
        rid,
        "Mangler companyId/userId for AI-kontekst (body eller REVENUE_AUTOPILOT_COMPANY_ID + innlogget bruker).",
        422,
        "REVENUE_AI_CONTEXT_MISSING",
      );
    }

    try {
      const out = await runRevenueAutopilotLoop({
        rid,
        aiCtx: { companyId, userId },
        dryRun,
      });
      if (!out.ok) {
        opsLog("revenue_autopilot_loop_failed", { rid, error: out.error });
        return jsonErr(rid, out.error ?? "Kjøring feilet.", 500, "REVENUE_LOOP_FAILED");
      }
      return jsonOk(rid, out, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      opsLog("revenue_autopilot_loop_exception", { rid, message: msg });
      return jsonErr(rid, msg, 500, "REVENUE_LOOP_EXCEPTION");
    }
  });
}
